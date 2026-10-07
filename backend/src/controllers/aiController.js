import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { cloudinary } from '../config/cloudinary.js';
import { spawn } from 'child_process';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join, posix } from 'path';
import groqAI from '../services/groqAIService.js';

const prisma = new PrismaClient();
const aiUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 6 }
});

export { aiUpload };

const runPdfTextExtraction = (buffer) => new Promise((resolve) => {
  const child = spawn('pdftotext', ['-', '-'], { stdio: ['pipe', 'pipe', 'ignore'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString('utf8'); });
  child.on('error', () => resolve(''));
  child.on('close', (code) => resolve(code === 0 ? output.trim() : ''));
  child.stdin.end(buffer);
});

const ZIP_TEXT_EXTENSIONS = /\.(txt|md|json|csv|log|xml|html|htm|css|js|jsx|mjs|cjs|ts|tsx|sql|prisma|graphql|gql|yaml|yml|toml|ini|conf|env|sh|bash|py|java|kt|go|rs|rb|php|c|h|cpp|hpp|cs|swift|vue|svelte)$/i;
const ZIP_TEXT_BASENAMES = /^(readme(?:\.[^.]*)?|license(?:\.[^.]*)?|dockerfile|makefile|compose\.ya?ml|\.env(?:\..*)?)$/i;
const ZIP_SKIP_PARTS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.vite', 'vendor']);

const runUnzipList = (zipPath) => new Promise((resolve) => {
  const child = spawn('unzip', ['-Z1', zipPath], { stdio: ['ignore', 'pipe', 'ignore'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString('utf8'); if (output.length > 1000000) child.kill(); });
  child.on('error', () => resolve([]));
  child.on('close', (code) => resolve(code === 0 ? output.split(/\r?\n/).filter(Boolean) : []));
});

const runUnzipFile = (zipPath, entryName, maxChars = 12000) => new Promise((resolve) => {
  const child = spawn('unzip', ['-p', zipPath, entryName], { stdio: ['ignore', 'pipe', 'ignore'] });
  let output = '';
  let truncated = false;
  child.stdout.on('data', (chunk) => {
    if (output.length < maxChars) {
      output += chunk.toString('utf8');
      if (output.length >= maxChars) { output = output.slice(0, maxChars); truncated = true; child.kill(); }
    }
  });
  child.on('error', () => resolve(''));
  child.on('close', () => resolve(output + (truncated ? '\n[truncated]' : '')));
});

const extractZipText = async (buffer) => {
  const dir = await mkdtemp(join(tmpdir(), 'ra-ai-zip-'));
  const zipPath = join(dir, 'upload.zip');
  try {
    await writeFile(zipPath, buffer);
    const entries = await runUnzipList(zipPath);
    const candidates = entries.filter((entry) => {
      const normalized = entry.replaceAll('\\', '/').replace(/^\/+/, '');
      if (!normalized || normalized.endsWith('/')) return false;
      if (normalized.split('/').some((part) => ZIP_SKIP_PARTS.has(part))) return false;
      if (normalized.split('/').includes('..')) return false;
      const base = posix.basename(normalized);
      return ZIP_TEXT_EXTENSIONS.test(base) || ZIP_TEXT_BASENAMES.test(base);
    }).sort((a, b) => {
      const priority = (name) => {
        const n = name.toLowerCase();
        if (/\/(package(-lock)?\.json|vite\.config|vercel\.json|prisma\/schema\.prisma|readme)/.test(n) || /(^|\/)(package(-lock)?\.json|vite\.config|vercel\.json|schema\.prisma|readme)/.test(n)) return 100;
        if (/\/(frontend|backend)\/src\//.test(n)) return 90;
        if (/\/(frontend|backend)\//.test(n)) return 70;
        return 50;
      };
      return priority(b) - priority(a);
    }).slice(0, 80);

    const sections = [];
    let total = 0;
    for (const entry of candidates) {
      if (total >= 50000) break;
      const remaining = Math.min(12000, 50000 - total);
      const text = await runUnzipFile(zipPath, entry, remaining);
      if (!text.trim()) continue;
      const section = `FILE: ${entry}\n${text}`;
      sections.push(section);
      total += section.length + 2;
    }
    if (!sections.length) return '';
    return `ZIP PROJECT CONTENTS (text/code files extracted automatically):\n\n${sections.join('\n\n---\n\n')}`.slice(0, 50000);
  } catch (error) {
    console.error('ZIP extraction error:', error);
    return '';
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
};

const extractAIFileText = async (file) => {
  const name = file.originalname || '';
  const mime = file.mimetype || '';
  if (mime === 'application/zip' || mime === 'application/x-zip-compressed' || /\.zip$/i.test(name)) {
    return extractZipText(file.buffer);
  }
  if (mime.startsWith('text/') || /\.(txt|md|json|csv|log|xml|html|htm|css|js|jsx|mjs|cjs|ts|tsx|sql|prisma|graphql|gql|yaml|yml|toml|ini|conf|env|sh|bash|py|java|kt|go|rs|rb|php|c|h|cpp|hpp|cs|swift|vue|svelte)$/i.test(name)) {
    return file.buffer.toString('utf8').slice(0, 50000);
  }
  if (mime === 'application/pdf' || /\.pdf$/i.test(name)) {
    const text = await runPdfTextExtraction(file.buffer);
    return text.slice(0, 50000);
  }
  return '';
};


const uploadBuffer = (file) => new Promise((resolve, reject) => {
  const isVideo = file.mimetype?.startsWith('video/');
  const isImage = file.mimetype?.startsWith('image/');
  const resourceType = isImage || isVideo ? 'auto' : 'raw';
  const stream = cloudinary.uploader.upload_stream({
    folder: 'ra-social/ai-chat',
    resource_type: resourceType,
    public_id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }, (error, result) => error ? reject(error) : resolve(result));
  stream.end(file.buffer);
});

export const uploadAIFile = async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ success: false, message: 'No files uploaded' });
    const oversizedVision = req.files.find((file) => file.mimetype?.startsWith('image/') && file.size > 20 * 1024 * 1024);
    if (oversizedVision) return res.status(400).json({ success: false, message: 'Image files must be 20 MB or smaller for Groq Vision.' });
    const files = await Promise.all(req.files.map(async (file) => {
      const result = await uploadBuffer(file);
      const extractedText = await extractAIFileText(file);
      const textPreview = extractedText ? extractedText.slice(0, 20000) : null;
      return {
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: result.secure_url || result.url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        ...(textPreview ? { textPreview } : {})
      };
    }));
    res.json({ success: true, data: { files } });
  } catch (error) {
    console.error('AI file upload error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload AI attachment' });
  }
};

export const listAIConversations = async (req, res) => {
  try {
    const conversations = await prisma.aIConversation.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, updatedAt: true, createdAt: true, _count: { select: { messages: true } } }
    });
    res.json({ success: true, data: { conversations } });
  } catch (error) {
    console.error('AI history list error:', error);
    res.status(500).json({ success: false, message: 'Failed to load AI history' });
  }
};

export const getAIConversation = async (req, res) => {
  try {
    const conversation = await prisma.aIConversation.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });
    if (!conversation) return res.status(404).json({ success: false, message: 'AI conversation not found' });
    res.json({ success: true, data: { conversation } });
  } catch (error) {
    console.error('AI history get error:', error);
    res.status(500).json({ success: false, message: 'Failed to load AI conversation' });
  }
};

export const deleteAIConversation = async (req, res) => {
  try {
    const deleted = await prisma.aIConversation.deleteMany({ where: { id: req.params.id, userId: req.userId } });
    if (!deleted.count) return res.status(404).json({ success: false, message: 'AI conversation not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('AI history delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete AI conversation' });
  }
};


export const deepResearch = async (req, res) => {
  try {
    const { topic = '', depth = 'standard', conversationId } = req.body || {};
    if (!topic.trim()) return res.status(400).json({ success: false, message: 'Research topic is required' });
    let conversation = conversationId
      ? await prisma.aIConversation.findFirst({ where: { id: conversationId, userId: req.userId } })
      : null;
    if (conversationId && !conversation) return res.status(404).json({ success: false, message: 'AI conversation not found' });
    if (!conversation) conversation = await prisma.aIConversation.create({ data: { userId: req.userId, title: `Research: ${topic.trim().slice(0, 65)}` } });

    const result = await groqAI.deepResearch(topic.trim(), { depth });
    if (!result.success) return res.status(500).json({ success: false, message: result.error, conversationId: conversation.id });

    await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'user', content: topic.trim() } });
    const assistant = await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: result.response, model: result.model || null } });
    await prisma.aIConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    res.json({ success: true, data: {
      response: result.response, model: result.model, language: result.language, depth: result.depth,
      executedTools: result.executedTools || [], sources: result.sources || [],
      conversationId: conversation.id, messageId: assistant.id
    }});
  } catch (error) {
    console.error('Deep research error:', error);
    res.status(500).json({ success: false, message: 'Deep research failed' });
  }
};


export const codingAI = async (req, res) => {
  try {
    const { request = '', task = 'general', context = '', conversationId } = req.body || {};
    if (!request.trim()) return res.status(400).json({ success: false, message: 'Coding request is required' });

    let conversation;
    if (conversationId) {
      conversation = await prisma.aIConversation.findFirst({ where: { id: conversationId, userId: req.userId } });
      if (!conversation) return res.status(404).json({ success: false, message: 'AI conversation not found' });
    } else {
      conversation = await prisma.aIConversation.create({ data: { userId: req.userId, title: `Code: ${request.trim().slice(0, 65)}` } });
    }
    const previous = await prisma.aIMessage.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: 'asc' }, take: 24 });
    const historyContext = previous.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n').slice(-30000);
    const result = await groqAI.codingAI(request.trim(), { task, context: [context, historyContext].filter(Boolean).join('\n\n') });
    if (!result.success) return res.status(500).json({ success: false, message: result.error, conversationId: conversation.id });
    await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'user', content: request.trim() } });
    const assistant = await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: result.response, model: result.model || null } });
    await prisma.aIConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    res.json({ success: true, data: { response: result.response, model: result.model, language: result.language, coding: true, task, executedTools: result.executedTools || [], sources: result.sources || [], conversationId: conversation.id, messageId: assistant.id } });
  } catch (error) {
    console.error('Coding AI error:', error);
    res.status(500).json({ success: false, message: 'Coding AI failed' });
  }
};

export const socialAI = async (req, res) => {
  try {
    const { request = '', task = 'content_ideas', platform = 'all', tone = 'natural', context = '', conversationId } = req.body || {};
    if (!request.trim()) return res.status(400).json({ success: false, message: 'Social media request is required' });
    let conversation;
    if (conversationId) {
      conversation = await prisma.aIConversation.findFirst({ where: { id: conversationId, userId: req.userId } });
      if (!conversation) return res.status(404).json({ success: false, message: 'AI conversation not found' });
    } else {
      conversation = await prisma.aIConversation.create({ data: { userId: req.userId, title: `Social: ${request.trim().slice(0, 65)}` } });
    }
    const previous = await prisma.aIMessage.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: 'asc' }, take: 20 });
    const historyContext = previous.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n').slice(-24000);
    const result = await groqAI.socialAI(request.trim(), { task, platform, tone, context: [context, historyContext].filter(Boolean).join('\n\n') });
    if (!result.success) return res.status(500).json({ success: false, message: result.error, conversationId: conversation.id });
    await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'user', content: request.trim() } });
    const assistant = await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: result.response, model: result.model || null } });
    await prisma.aIConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    res.json({ success: true, data: { response: result.response, model: result.model, language: result.language, socialAI: true, task, platform, tone, conversationId: conversation.id, messageId: assistant.id } });
  } catch (error) {
    console.error('Social AI error:', error);
    res.status(500).json({ success: false, message: 'Social Media AI failed' });
  }
};

export const analyzeAIFiles = async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ success: false, message: 'No files uploaded' });
    const { task = 'summarize', question = '', conversationId } = req.body || {};
    const allowedTasks = new Set(['summarize', 'extract', 'compare', 'qa', 'outline', 'translate']);
    const selectedTask = allowedTasks.has(task) ? task : 'summarize';
    let conversation = conversationId
      ? await prisma.aIConversation.findFirst({ where: { id: conversationId, userId: req.userId } })
      : null;
    if (conversationId && !conversation) return res.status(404).json({ success: false, message: 'AI conversation not found' });
    if (!conversation) conversation = await prisma.aIConversation.create({ data: { userId: req.userId, title: `Files: ${(question || selectedTask).trim().slice(0, 65)}` } });

    const extracted = [];
    for (const file of req.files.slice(0, 6)) {
      const text = await extractAIFileText(file);
      extracted.push({ name: file.originalname, mimeType: file.mimetype, size: file.size, text: text.slice(0, 50000) });
    }
    const usable = extracted.filter((item) => item.text.trim());
    if (!usable.length) return res.status(400).json({ success: false, message: 'No readable text was found. ZIP files, code/text files and text-based PDFs are supported; binary files may need a more specific AI mode.', conversationId: conversation.id });

    const languageInfo = groqAI._detectLanguage(question || selectedTask);
    const instructions = {
      summarize: 'Summarize each file and then give a combined summary. Preserve important facts, numbers and caveats.',
      extract: 'Extract the most important facts, entities, dates, numbers, action items and structured data. Use clear headings.',
      compare: 'Compare the files carefully. Identify agreements, differences, contradictions, missing information and which file supports each point.',
      qa: `Answer the user question using only the supplied file contents. If the files do not support an answer, say so. User question: ${question}`,
      outline: 'Create a clean hierarchical outline of the supplied documents, preserving their main structure and topics.',
      translate: 'Translate the supplied file text into the requested language while preserving structure and meaning.'
    }[selectedTask];
    const context = usable.map((item, i) => `FILE ${i + 1}: ${item.name}\n${item.text}`).join('\n\n---\n\n');
    const result = await groqAI.analyzeFileText(instructions, context, languageInfo);
    if (!result.success) return res.status(500).json({ success: false, message: result.error, conversationId: conversation.id });

    const userContent = question.trim() || `${selectedTask} the attached file(s).`;
    await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'user', content: userContent, attachments: extracted.map(({ name, mimeType, size }) => ({ name, mimeType, size })) } });
    const assistant = await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: result.response, model: result.model || null } });
    await prisma.aIConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    res.json({ success: true, data: { response: result.response, model: result.model, language: result.language, task: selectedTask, files: extracted.map(({ name, mimeType, size }) => ({ name, mimeType, size })), conversationId: conversation.id, messageId: assistant.id } });
  } catch (error) {
    console.error('AI file analysis error:', error);
    res.status(500).json({ success: false, message: 'Failed to analyze files' });
  }
};


export const dataAI = async (req, res) => {
  try {
    const { request = '', task = 'analyze', context = '', conversationId } = req.body || {};
    if (!request.trim()) return res.status(400).json({ success: false, message: 'Data or reasoning request is required' });
    let conversation;
    if (conversationId) {
      conversation = await prisma.aIConversation.findFirst({ where: { id: conversationId, userId: req.userId } });
      if (!conversation) return res.status(404).json({ success: false, message: 'AI conversation not found' });
    } else {
      conversation = await prisma.aIConversation.create({ data: { userId: req.userId, title: `Data: ${request.trim().slice(0, 65)}` } });
    }
    const previous = await prisma.aIMessage.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: 'asc' }, take: 20 });
    const historyContext = previous.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n').slice(-24000);
    const result = await groqAI.dataAI(request.trim(), { task, context: [context, historyContext].filter(Boolean).join('\n\n') });
    if (!result.success) return res.status(500).json({ success: false, message: result.error, conversationId: conversation.id });
    await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'user', content: request.trim() } });
    const assistant = await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: result.response, model: result.model || null } });
    await prisma.aIConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    res.json({ success: true, data: { response: result.response, model: result.model, language: result.language, dataAI: true, task, executedTools: result.executedTools || [], sources: result.sources || [], conversationId: conversation.id, messageId: assistant.id } });
  } catch (error) {
    console.error('Reasoning/Data AI error:', error);
    res.status(500).json({ success: false, message: 'Reasoning/Data AI failed' });
  }
};



export const writingAI = async (req, res) => {
  try {
    const { request = '', task = 'general', tone = 'natural', length = 'medium', context = '', conversationId } = req.body || {};
    if (!request.trim()) return res.status(400).json({ success: false, message: 'Writing request is required' });
    let conversation;
    if (conversationId) {
      conversation = await prisma.aIConversation.findFirst({ where: { id: conversationId, userId: req.userId } });
      if (!conversation) return res.status(404).json({ success: false, message: 'AI conversation not found' });
    } else {
      conversation = await prisma.aIConversation.create({ data: { userId: req.userId, title: `Writing: ${request.trim().slice(0, 65)}` } });
    }
    const previous = await prisma.aIMessage.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: 'asc' }, take: 16 });
    const historyContext = previous.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n').slice(-20000);
    const result = await groqAI.writingAI(request.trim(), { task, tone, length, context: [context, historyContext].filter(Boolean).join('\n\n') });
    if (!result.success) return res.status(500).json({ success: false, message: result.error, conversationId: conversation.id });
    await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'user', content: request.trim() } });
    const assistant = await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: result.response, model: result.model || null } });
    await prisma.aIConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    res.json({ success: true, data: { response: result.response, model: result.model, language: result.language, writing: true, task, tone, length, conversationId: conversation.id, messageId: assistant.id } });
  } catch (error) {
    console.error('Writing AI error:', error);
    res.status(500).json({ success: false, message: 'Writing AI failed' });
  }
};


export const creativeAI = async (req, res) => {
  try {
    const { request = '', task = 'idea', style = 'creative', conversationId } = req.body || {};
    if (!request.trim()) return res.status(400).json({ success: false, message: 'Creative request is required' });
    let conversation = conversationId ? await prisma.aIConversation.findFirst({ where: { id: conversationId, userId: req.userId } }) : null;
    if (conversationId && !conversation) return res.status(404).json({ success: false, message: 'AI conversation not found' });
    if (!conversation) conversation = await prisma.aIConversation.create({ data: { userId: req.userId, title: `Creative: ${request.trim().slice(0, 65)}` } });
    const result = await groqAI.creativeAI(request.trim(), { task, style });
    if (!result.success) return res.status(500).json({ success: false, message: result.error, conversationId: conversation.id });
    await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'user', content: request.trim() } });
    const assistant = await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: result.response, model: result.model || null } });
    await prisma.aIConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    res.json({ success: true, data: { response: result.response, model: result.model, language: result.language, creativeAI: true, task, style, conversationId: conversation.id, messageId: assistant.id } });
  } catch (error) { console.error('Creative AI error:', error); res.status(500).json({ success: false, message: 'Creative AI failed' }); }
};

export const videoAI = async (req, res) => {
  try {
    const { request = '', task = 'storyboard', duration = 'short', conversationId } = req.body || {};
    if (!request.trim()) return res.status(400).json({ success: false, message: 'Video request is required' });
    let conversation = conversationId ? await prisma.aIConversation.findFirst({ where: { id: conversationId, userId: req.userId } }) : null;
    if (conversationId && !conversation) return res.status(404).json({ success: false, message: 'AI conversation not found' });
    if (!conversation) conversation = await prisma.aIConversation.create({ data: { userId: req.userId, title: `Video: ${request.trim().slice(0, 65)}` } });
    const result = await groqAI.videoAI(request.trim(), { task, duration });
    if (!result.success) return res.status(500).json({ success: false, message: result.error, conversationId: conversation.id });
    await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'user', content: request.trim() } });
    const assistant = await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: result.response, model: result.model || null } });
    await prisma.aIConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    res.json({ success: true, data: { response: result.response, model: result.model, language: result.language, videoAI: true, task, duration, conversationId: conversation.id, messageId: assistant.id } });
  } catch (error) { console.error('Video AI error:', error); res.status(500).json({ success: false, message: 'Video AI failed' }); }
};

export const transcribeAI = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: 'Audio file is required' });
    if (file.size > 25 * 1024 * 1024) return res.status(400).json({ success: false, message: 'Audio files must be 25 MB or smaller.' });
    const result = await groqAI.transcribeAudio(file.buffer, file.originalname, file.mimetype);
    if (!result.success) return res.status(500).json({ success: false, message: result.error });
    res.json({ success: true, data: { text: result.text, model: result.model } });
  } catch (error) { console.error('AI transcription error:', error); res.status(500).json({ success: false, message: 'Voice transcription failed' }); }
};



const uploadGeneratedMedia = (buffer, contentType, type) => new Promise((resolve, reject) => {
  const isVideo = type === 'video';
  const stream = cloudinary.uploader.upload_stream({
    folder: 'ra-social/ai-generated',
    resource_type: isVideo ? 'video' : 'image',
    public_id: `gen_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    chunk_size: isVideo ? 6 * 1024 * 1024 : undefined,
    timeout: isVideo ? 600000 : 120000
  }, (error, result) => error ? reject(error) : resolve(result));
  stream.end(buffer);
});

export const generateAIImage = async (req, res) => {
  try {
    const { prompt = '', width = 1024, height = 1024, conversationId } = req.body || {};
    if (!prompt.trim()) return res.status(400).json({ success: false, message: 'Image prompt is required' });
    const result = await groqAI.generateMedia(prompt, { type: 'image', width, height });
    if (!result.success) return res.status(503).json({ success: false, message: result.error });
    const uploaded = await uploadGeneratedMedia(result.buffer, result.contentType, 'image');
    const url = uploaded.secure_url || uploaded.url;
    let conversation = conversationId ? await prisma.aIConversation.findFirst({ where: { id: conversationId, userId: req.userId } }) : null;
    if (!conversation) conversation = await prisma.aIConversation.create({ data: { userId: req.userId, title: `Image: ${prompt.trim().slice(0, 65)}` } });
    await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'user', content: prompt.trim() } });
    const message = await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: 'Image generated successfully.', model: result.model || null, attachments: [{ url, type: 'image', name: 'AI generated image', provider: result.provider }] } });
    await prisma.aIConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    res.json({ success: true, data: { url, type: 'image', model: result.model, provider: result.provider, conversationId: conversation.id, messageId: message.id } });
  } catch (error) {
    console.error('AI image generation error:', error);
    res.status(500).json({ success: false, message: error?.message || 'Image generation failed' });
  }
};

export const editAIImage = async (req, res) => {
  try {
    const { prompt = '', conversationId, model = '', imageUrl = '' } = req.body || {};
    if (!prompt.trim()) return res.status(400).json({ success: false, message: 'Image edit prompt is required' });
    let imageBuffer = req.file?.buffer || null;
    let imageName = req.file?.originalname || 'source-image.jpg';
    let imageMime = req.file?.mimetype || 'image/jpeg';
    if (!imageBuffer && imageUrl) {
      try {
        const source = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 120000, maxContentLength: 25 * 1024 * 1024 });
        imageBuffer = Buffer.from(source.data);
        imageMime = String(source.headers?.['content-type'] || 'image/jpeg').split(';')[0];
      } catch (_) {
        return res.status(400).json({ success: false, message: 'Could not load the source image for editing' });
      }
    }
    if (!imageBuffer?.length) return res.status(400).json({ success: false, message: 'Please attach an image to edit' });
    if (!imageMime.startsWith('image/')) return res.status(400).json({ success: false, message: 'Only image files can be edited' });

    const result = await groqAI.editImage(imageBuffer, imageName, imageMime, prompt, { model });
    if (!result.success) return res.status(503).json({ success: false, message: result.error });
    const uploaded = await uploadGeneratedMedia(result.buffer, result.contentType, 'image');
    const url = uploaded.secure_url || uploaded.url;
    let conversation = conversationId ? await prisma.aIConversation.findFirst({ where: { id: conversationId, userId: req.userId } }) : null;
    if (!conversation) conversation = await prisma.aIConversation.create({ data: { userId: req.userId, title: `Edit: ${prompt.trim().slice(0, 65)}` } });
    await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'user', content: prompt.trim(), attachments: [{ type: 'image', name: req.file.originalname || 'source image' }] } });
    const message = await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: 'Image edited successfully.', model: result.model || null, attachments: [{ url, type: 'image', name: 'AI edited image', provider: result.provider }] } });
    await prisma.aIConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    res.json({ success: true, data: { url, type: 'image', model: result.model, provider: result.provider, conversationId: conversation.id, messageId: message.id } });
  } catch (error) {
    console.error('AI image edit error:', error);
    res.status(500).json({ success: false, message: error?.message || 'Image editing failed' });
  }
};

export const generateAIVideo = async (req, res) => {
  try {
    const { prompt = '', duration = 4, conversationId } = req.body || {};
    if (!prompt.trim()) return res.status(400).json({ success: false, message: 'Video prompt is required' });
    const result = await groqAI.generateMedia(prompt, { type: 'video', duration });
    if (!result.success) return res.status(503).json({ success: false, message: result.error });
    const uploaded = await uploadGeneratedMedia(result.buffer, result.contentType, 'video');
    const url = uploaded.secure_url || uploaded.url;
    let conversation = conversationId ? await prisma.aIConversation.findFirst({ where: { id: conversationId, userId: req.userId } }) : null;
    if (!conversation) conversation = await prisma.aIConversation.create({ data: { userId: req.userId, title: `Video: ${prompt.trim().slice(0, 65)}` } });
    await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'user', content: prompt.trim() } });
    const message = await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: 'Video generated successfully.', model: result.model || null, attachments: [{ url, type: 'video', name: 'AI generated video', provider: result.provider }] } });
    await prisma.aIConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    res.json({ success: true, data: { url, type: 'video', model: result.model, provider: result.provider, duration, conversationId: conversation.id, messageId: message.id } });
  } catch (error) {
    console.error('AI video generation error:', error);
    res.status(500).json({ success: false, message: error?.message || 'Video generation failed' });
  }
};

export const listAIMemories = async (req, res) => {
  try {
    const memories = await prisma.aIMemory.findMany({ where: { userId: req.userId }, orderBy: { updatedAt: 'desc' }, take: 100 });
    res.json({ success: true, data: { memories } });
  } catch (error) { console.error('AI memory list error:', error); res.status(500).json({ success: false, message: 'Failed to load AI memory' }); }
};

export const saveAIMemory = async (req, res) => {
  try {
    const { content = '', category = 'general' } = req.body || {};
    const value = content.trim().slice(0, 2000);
    if (!value) return res.status(400).json({ success: false, message: 'Memory content is required' });
    const memory = await prisma.aIMemory.create({ data: { userId: req.userId, content: value, category: String(category).slice(0, 40) || 'general' } });
    res.json({ success: true, data: { memory } });
  } catch (error) { console.error('AI memory save error:', error); res.status(500).json({ success: false, message: 'Failed to save AI memory' }); }
};

export const deleteAIMemory = async (req, res) => {
  try {
    const deleted = await prisma.aIMemory.deleteMany({ where: { id: req.params.id, userId: req.userId } });
    if (!deleted.count) return res.status(404).json({ success: false, message: 'AI memory not found' });
    res.json({ success: true });
  } catch (error) { console.error('AI memory delete error:', error); res.status(500).json({ success: false, message: 'Failed to delete AI memory' }); }
};



export const aiCapabilities = async (req, res) => {
  res.json({ success: true, data: {
    provider: 'Groq',
    modes: ['auto', 'research', 'vision', 'files', 'coding', 'data', 'writing', 'social', 'creative', 'video', 'voice', 'memory'],
    tools: ['web_search', 'visit_website', 'code_interpreter', 'image_generation', 'video_generation'],
    models: { fast: process.env.GROQ_FAST_MODEL || 'openai/gpt-oss-20b', reasoning: process.env.GROQ_REASONING_MODEL || 'openai/gpt-oss-120b', agent: process.env.GROQ_AGENT_MODEL || 'groq/compound', vision: process.env.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b' },
    media: { provider: 'Pollinations', imageModel: process.env.POLLINATIONS_IMAGE_MODEL || 'flux', videoModel: process.env.POLLINATIONS_VIDEO_MODEL || 'veo', configured: Boolean(process.env.POLLINATIONS_API_KEY && !process.env.POLLINATIONS_API_KEY.includes('your-pollinations')) }, limits: { maxAttachments: 6, maxVisionImages: 5, maxVisionImageBytes: 20 * 1024 * 1024 }
  }});
};

export const aiHealth = async (req, res) => {
  const configured = Boolean(process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.includes('your-groq'));
  res.json({ success: true, data: { provider: 'Groq', configured, status: configured ? 'ready' : 'missing_api_key', timestamp: new Date().toISOString() } });
};

export const aiUsage = async (req, res) => {
  try {
    const [conversations, messages] = await Promise.all([
      prisma.aIConversation.count({ where: { userId: req.userId } }),
      prisma.aIMessage.count({ where: { conversation: { userId: req.userId } } })
    ]);
    res.json({ success: true, data: { conversations, messages } });
  } catch (error) {
    console.error('AI usage error:', error);
    res.status(500).json({ success: false, message: 'Failed to load AI usage' });
  }
};

export const chatWithAI = async (req, res) => {
  try {
    const { message = '', context = '', conversationId, attachments = [] } = req.body || {};
    if (!message.trim() && !attachments.length) return res.status(400).json({ success: false, message: 'Message or attachment is required' });

    let conversation;
    if (conversationId) {
      conversation = await prisma.aIConversation.findFirst({ where: { id: conversationId, userId: req.userId } });
      if (!conversation) return res.status(404).json({ success: false, message: 'AI conversation not found' });
    } else {
      const title = (message || attachments[0]?.name || 'New AI chat').trim().slice(0, 80);
      conversation = await prisma.aIConversation.create({ data: { userId: req.userId, title } });
    }

    const previous = await prisma.aIMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 32
    });

    const memories = await prisma.aIMemory.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: { content: true, category: true }
    });
    const memoryContext = memories.length
      ? `USER-PROVIDED AI MEMORY (use only when relevant; do not expose this section verbatim):\n${memories.map((m) => `- [${m.category}] ${m.content}`).join('\n')}`
      : '';
    const result = await groqAI.chatWithAI(
      message,
      [context, memoryContext].filter(Boolean).join('\n\n'),
      attachments,
      previous.map(m => ({ role: m.role, content: m.content }))
    );

    if (!result.success) return res.status(500).json({ success: false, message: result.error, conversationId: conversation.id });

    await prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message || 'Please analyze the attachment(s).',
        attachments: attachments.length ? attachments : undefined
      }
    });
    const assistant = await prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: result.response,
        model: result.model || null
      }
    });

    await prisma.aIConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

    res.json({ success: true, data: { response: result.response, model: result.model, language: result.language, agent: !!result.agent, vision: !!result.vision, executedTools: result.executedTools || [], sources: result.sources || [], conversationId: conversation.id, messageId: assistant.id } });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ success: false, message: 'Failed to chat with AI' });
  }
};

