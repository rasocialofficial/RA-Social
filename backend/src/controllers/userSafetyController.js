import prisma from '../config/database.js';

const allowed = new Set(['block', 'mute', 'restrict']);
const modelMap = {
  block: ['userBlock', 'blockerId_blockedId', 'blockerId', 'blockedId'],
  mute: ['userMute', 'muterId_mutedId', 'muterId', 'mutedId'],
  restrict: ['userRestrict', 'restrictorId_restrictedId', 'restrictorId', 'restrictedId']
};

export const getSafetyStatus = async (req, res) => {
  try {
    const userId = req.userId;
    const targetId = req.params.userId;
    if (userId === targetId) return res.status(400).json({ success:false, message:'Cannot apply this to yourself' });
    const [block, mute, restrict] = await Promise.all([
      prisma.userBlock.findUnique({ where:{ blockerId_blockedId:{ blockerId:userId, blockedId:targetId } } }),
      prisma.userMute.findUnique({ where:{ muterId_mutedId:{ muterId:userId, mutedId:targetId } } }),
      prisma.userRestrict.findUnique({ where:{ restrictorId_restrictedId:{ restrictorId:userId, restrictedId:targetId } } })
    ]);
    res.json({success:true,data:{blocked:!!block, muted:!!mute, restricted:!!restrict}});
  } catch (e) { console.error(e); res.status(500).json({success:false,message:'Failed to get safety status'}); }
};

export const toggleSafety = async (req, res) => {
  try {
    const userId = req.userId, targetId = req.params.userId, { action } = req.body;
    if (!targetId || userId === targetId || !allowed.has(action)) return res.status(400).json({success:false,message:'Invalid user or action'});
    const target = await prisma.user.findUnique({where:{id:targetId},select:{id:true}});
    if (!target) return res.status(404).json({success:false,message:'User not found'});
    const [model, unique, mine, theirs] = modelMap[action];
    const client = prisma[model];
    const existing = await client.findUnique({where:{[unique]:{[mine]:userId,[theirs]:targetId}}});
    let enabled;
    if (existing) { await client.delete({where:{id:existing.id}}); enabled=false; }
    else { await client.create({data:{[mine]:userId,[theirs]:targetId}}); enabled=true; }
    if (action === 'block' && enabled) {
      await prisma.follow.deleteMany({where:{OR:[{followerId:userId,followingId:targetId},{followerId:targetId,followingId:userId}]}});
    }
    res.json({success:true,data:{action,enabled}});
  } catch (e) { console.error(e); res.status(500).json({success:false,message:'Failed to update user safety setting'}); }
};
