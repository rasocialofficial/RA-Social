import prisma from '../config/database.js';

const getSafetyPair = async (userId, otherId) => {
  const [blockedByMe, blockedMe] = await Promise.all([
    prisma.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId: userId, blockedId: otherId } } }),
    prisma.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId: otherId, blockedId: userId } } })
  ]);
  return { blockedByMe: !!blockedByMe, blockedMe: !!blockedMe };
};

export const getChats = async (req, res) => {
  try {
    const userId = req.userId;
    const chats = await prisma.chat.findMany({
      where: { participants: { some: { id: userId } } },
      include: { participants: { select: { id: true, username: true, fullName: true, avatarUrl: true } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' }
    });
    res.json({ success: true, data: chats });
  } catch (error) { console.error('Get chats error:', error); res.status(500).json({ success: false, message: 'Failed to fetch chats' }); }
};

export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params, userId = req.userId;
    const chat = await prisma.chat.findFirst({ where: { id: chatId, participants: { some: { id: userId } } }, select: { id: true } });
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
    await prisma.message.updateMany({ where: { chatId, senderId: { not: userId }, isRead: false }, data: { isRead: true } });
    const hidden = await prisma.messageHidden.findMany({ where: { userId }, select: { messageId: true } });
    const hiddenIds = hidden.map(h => h.messageId);
    const messages = await prisma.message.findMany({ where: { chatId, id: { notIn: hiddenIds } }, include: { sender: { select: { id: true, username: true, avatarUrl: true } }, replyTo: { include: { sender: { select: { id: true, username: true, avatarUrl: true } } } } }, orderBy: { createdAt: 'asc' } });
    const readIds = messages.filter(m => m.senderId !== userId && m.isRead).map(m => m.id);
    if (readIds.length) req.app.get('io')?.to(`chat:${chatId}`).emit('message_read', { chatId, messageIds: readIds });
    res.json({ success: true, data: messages });
  } catch (error) { console.error('Get messages error:', error); res.status(500).json({ success: false, message: 'Failed to fetch messages' }); }
};

export const markChatRead = async (req, res) => {
  try {
    const { chatId } = req.params, userId = req.userId;
    const chat = await prisma.chat.findFirst({ where: { id: chatId, participants: { some: { id: userId } } }, select: { id: true } });
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
    const unread = await prisma.message.findMany({ where: { chatId, senderId: { not: userId }, isRead: false }, select: { id: true } });
    const messageIds = unread.map(m => m.id);
    if (messageIds.length) { await prisma.message.updateMany({ where: { id: { in: messageIds } }, data: { isRead: true } }); req.app.get('io')?.to(`chat:${chatId}`).emit('message_read', { chatId, messageIds }); }
    res.json({ success: true, data: { messageIds } });
  } catch (error) { console.error('Mark chat read error:', error); res.status(500).json({ success: false, message: 'Failed to mark messages as read' }); }
};

export const createChat = async (req, res) => {
  try {
    const { participantId } = req.body, userId = req.userId;
    if (!participantId || participantId === userId) return res.status(400).json({ success: false, message: 'Choose another user' });
    const participant = await prisma.user.findUnique({ where: { id: participantId }, select: { id: true, status: true } });
    if (!participant || participant.status === 'blocked') return res.status(404).json({ success: false, message: 'User is not available for chat' });
    const safety = await getSafetyPair(userId, participantId);
    if (safety.blockedByMe || safety.blockedMe) return res.status(403).json({ success: false, message: 'You cannot start a chat with this user' });
    const existingChat = await prisma.chat.findFirst({ where: { AND: [{ participants: { some: { id: userId } } }, { participants: { some: { id: participantId } } }] }, include: { participants: true } });
    if (existingChat) return res.json({ success: true, data: existingChat, exists: true });
    const chat = await prisma.chat.create({ data: { participants: { connect: [{ id: userId }, { id: participantId }] } }, include: { participants: true } });
    res.json({ success: true, data: chat, exists: false });
  } catch (error) { console.error('Create chat error:', error); res.status(500).json({ success: false, message: 'Failed to create chat' }); }
};

export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params, { content, mediaUrl, replyToId, forwardedFromId } = req.body, userId = req.userId;
    if (!content?.trim() && !mediaUrl) return res.status(400).json({ success: false, message: 'Message content is required' });
    const chat = await prisma.chat.findFirst({ where: { id: chatId, participants: { some: { id: userId } } }, include: { participants: { select: { id: true } } } });
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
    const otherParticipant = chat.participants.find(p => p.id !== userId);
    if (otherParticipant) { const safety = await getSafetyPair(userId, otherParticipant.id); if (safety.blockedByMe || safety.blockedMe) return res.status(403).json({ success: false, message: 'Messaging is unavailable for this user' }); }
    if (replyToId) { const reply = await prisma.message.findFirst({ where: { id: replyToId, chatId } }); if (!reply) return res.status(400).json({ success: false, message: 'Reply target not found' }); }
    const message = await prisma.message.create({ data: { chatId, senderId: userId, content: content?.trim() || '', mediaUrl: mediaUrl || null, replyToId: replyToId || null, forwardedFromId: forwardedFromId || null }, include: { sender: { select: { id: true, username: true, avatarUrl: true } }, replyTo: { include: { sender: { select: { id: true, username: true, avatarUrl: true } } } } } });
    await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
    req.app.get('io')?.to(`chat:${chatId}`).emit('new_message', message);
    res.status(201).json({ success: true, data: message });
  } catch (error) { console.error('Send message error:', error); res.status(500).json({ success: false, message: 'Failed to send message' }); }
};

export const deleteMessageForMe = async (req, res) => {
  try { const { chatId, messageId } = req.params, userId = req.userId; const message = await prisma.message.findFirst({ where: { id: messageId, chatId, chat: { participants: { some: { id: userId } } } } }); if (!message) return res.status(404).json({ success: false, message: 'Message not found' }); await prisma.messageHidden.upsert({ where: { messageId_userId: { messageId, userId } }, update: {}, create: { messageId, userId } }); req.app.get('io')?.to(`chat:${chatId}`).emit('message_hidden', { chatId, messageId, userId }); res.json({ success: true, data: { messageId } }); }
  catch (error) { console.error('Delete message for me error:', error); res.status(500).json({ success: false, message: 'Failed to delete message' }); }
};
export const deleteMessageForEveryone = async (req, res) => {
  try { const { chatId, messageId } = req.params, userId = req.userId; const message = await prisma.message.findFirst({ where: { id: messageId, chatId, senderId: userId, chat: { participants: { some: { id: userId } } } } }); if (!message) return res.status(404).json({ success: false, message: 'Only your own message can be deleted for everyone' }); await prisma.message.delete({ where: { id: messageId } }); req.app.get('io')?.to(`chat:${chatId}`).emit('message_deleted', { chatId, messageId }); res.json({ success: true, data: { messageId } }); }
  catch (error) { console.error('Delete message for everyone error:', error); res.status(500).json({ success: false, message: 'Failed to delete message for everyone' }); }
};
export const toggleMessagePin = async (req, res) => {
  try { const { chatId, messageId } = req.params, userId = req.userId; const message = await prisma.message.findFirst({ where: { id: messageId, chatId, chat: { participants: { some: { id: userId } } } } }); if (!message) return res.status(404).json({ success: false, message: 'Message not found' }); const updated = await prisma.message.update({ where: { id: messageId }, data: { pinned: !message.pinned } }); req.app.get('io')?.to(`chat:${chatId}`).emit('message_pin_changed', { chatId, messageId, pinned: updated.pinned }); res.json({ success: true, data: updated }); }
  catch (error) { console.error('Toggle message pin error:', error); res.status(500).json({ success: false, message: 'Failed to update pinned message' }); }
};
export const forwardMessage = async (req, res) => {
  try { const { chatId, messageId } = req.params, { targetChatId } = req.body, userId = req.userId; if (!targetChatId) return res.status(400).json({ success: false, message: 'Target chat is required' }); const [source, target] = await Promise.all([prisma.message.findFirst({ where: { id: messageId, chatId, chat: { participants: { some: { id: userId } } } } }), prisma.chat.findFirst({ where: { id: targetChatId, participants: { some: { id: userId } } } })]); if (!source || !target) return res.status(404).json({ success: false, message: !source ? 'Source message not found' : 'Target chat not found' }); const message = await prisma.message.create({ data: { chatId: targetChatId, senderId: userId, content: source.content || '', mediaUrl: source.mediaUrl || null, forwardedFromId: source.id }, include: { sender: { select: { id: true, username: true, avatarUrl: true } } } }); await prisma.chat.update({ where: { id: targetChatId }, data: { updatedAt: new Date() } }); req.app.get('io')?.to(`chat:${targetChatId}`).emit('new_message', message); res.status(201).json({ success: true, data: message }); }
  catch (error) { console.error('Forward message error:', error); res.status(500).json({ success: false, message: 'Failed to forward message' }); }
};
