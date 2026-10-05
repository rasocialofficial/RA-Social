import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/database.js';
import { createSessionForUser } from './sessionController.js';
import { sendPasswordResetCode } from '../services/messageService.js';


const base32Encode = (bytes) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0, out = '';
  for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
};
const base32Decode = (input) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, value = 0; const out=[];
  for (const c of String(input).toUpperCase().replace(/=+$/,'')) { const n=alphabet.indexOf(c); if(n<0) throw new Error('Invalid secret'); value=(value<<5)|n; bits+=5; if(bits>=8){ out.push((value >>> (bits-8)) & 255); bits-=8; } }
  return Buffer.from(out);
};
const encrypt2FASecret = (secret) => {
  const key = crypto.createHash('sha256').update(String(process.env.JWT_SECRET || 'ra-social-2fa')).digest();
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', key, iv); const enc=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
};
const decrypt2FASecret = (packed) => {
  const [ivS, tagS, dataS] = String(packed || '').split('.'); if(!ivS||!tagS||!dataS) throw new Error('Invalid encrypted secret');
  const key=crypto.createHash('sha256').update(String(process.env.JWT_SECRET || 'ra-social-2fa')).digest(); const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(ivS,'base64url')); decipher.setAuthTag(Buffer.from(tagS,'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataS,'base64url')),decipher.final()]).toString('utf8');
};
const totpCode = (secret, counter) => {
  const key=base32Decode(secret); const buf=Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(counter)); const digest=crypto.createHmac('sha1',key).update(buf).digest(); const offset=digest[digest.length-1]&15; const num=((digest.readUInt32BE(offset)&0x7fffffff)%1000000); return String(num).padStart(6,'0');
};
const verifyTotp = (secret, code) => { const now=Math.floor(Date.now()/1000/30); const clean=String(code||'').replace(/\s/g,''); if(!/^\d{6}$/.test(clean)) return false; for(let d=-1;d<=1;d++) if(totpCode(secret,now+d)===clean) return true; return false; };
const makeBackupCodes = () => Array.from({length:8},()=>crypto.randomBytes(5).toString('hex').toUpperCase());
const hashBackupCode = (code) => bcrypt.hash(String(code).replace(/[^A-Za-z0-9]/g,'').toUpperCase(),10);
const consumeBackupCode = async (user, code) => {
  const normalized=String(code||'').replace(/[^A-Za-z0-9]/g,'').toUpperCase(); if(!normalized) return false; const hashes=Array.isArray(user.twoFactorBackupCodes)?user.twoFactorBackupCodes:[];
  for(let i=0;i<hashes.length;i++){ if(await bcrypt.compare(normalized, hashes[i])) { hashes.splice(i,1); await prisma.user.update({where:{id:user.id},data:{twoFactorBackupCodes:hashes}}); return true; } } return false;
};

export const checkUsername = async (req, res) => {
  try {
    const username = String(req.query.username || '').trim();

    if (!username) {
      return res.json({ success: true, data: { available: false, reason: 'empty' } });
    }

    if (username.length < 3) {
      return res.json({ success: true, data: { available: false, reason: 'too_short' } });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });

    return res.json({
      success: true,
      data: { available: !existingUser }
    });
  } catch (error) {
    console.error('Check username error:', error);
    return res.status(500).json({ success: false, message: 'Failed to check username' });
  }
};

export const register = async (req, res) => {
  try {
    const { username, email, password, fullName, phoneNumber } = req.body;
    const normalizedPhone = phoneNumber ? String(phoneNumber).replace(/\D/g, '') : null;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Username, email and password are required' });
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }, ...(normalizedPhone ? [{ phoneNumber: normalizedPhone }] : [])] },
      select: { id: true, email: true, username: true, phoneNumber: true }
    });

    if (existingUser) {
      const duplicateField = existingUser.email === email
        ? 'email'
        : existingUser.username === username
          ? 'username'
          : 'phone number';
      return res.status(409).json({ success: false, message: `An account already exists with this ${duplicateField}` });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: { username, email, passwordHash, fullName: fullName || username, phoneNumber: normalizedPhone || null },
      select: { id: true, username: true, email: true, phoneNumber: true, fullName: true, avatarUrl: true, role: true, status: true, channelNumber: true, channelName: true, channelCreatedAt: true, createdAt: true }
    });

    const { tokenId } = await createSessionForUser(user.id, req);
    const token = jwt.sign({ userId: user.id, jti: tokenId }, process.env.JWT_SECRET, { expiresIn: '365d' });

    res.status(201).json({ success: true, message: 'User registered successfully', data: { user, token } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
};

export const login = async (req, res) => {
  try {
    const { identifier, email, password } = req.body;
    const loginIdentifier = String(identifier ?? email ?? '').trim();

    if (!loginIdentifier || !password) {
      return res.status(400).json({ success: false, message: 'Email, username or phone number and password are required' });
    }

    const normalizedPhone = loginIdentifier.replace(/\D/g, '');
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: loginIdentifier.toLowerCase() },
          { username: loginIdentifier },
          ...(normalizedPhone ? [{ phoneNumber: normalizedPhone }] : [])
        ]
      }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (user.status === 'blocked') {
      return res.status(403).json({ success: false, message: 'Your account has been blocked by an administrator' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.twoFactorEnabled) {
      const challengeToken = jwt.sign({ userId: user.id, purpose: '2fa-login' }, process.env.JWT_SECRET, { expiresIn: '10m' });
      return res.json({ success: true, message: 'Two-factor authentication required', data: { requiresTwoFactor: true, challengeToken } });
    }
    const { tokenId } = await createSessionForUser(user.id, req);
    const token = jwt.sign({ userId: user.id, jti: tokenId }, process.env.JWT_SECRET, { expiresIn: '365d' });
    res.json({ success: true, message: 'Login successful', data: { user: { id: user.id, username: user.username, email: user.email, phoneNumber: user.phoneNumber, fullName: user.fullName, avatarUrl: user.avatarUrl, bio: user.bio, role: user.role, status: user.status, channelNumber: user.channelNumber, channelName: user.channelName, channelCreatedAt: user.channelCreatedAt }, token } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

export const verifyTwoFactorLogin = async (req, res) => {
  try {
    const { challengeToken, code } = req.body || {}; if(!challengeToken||!code) return res.status(400).json({success:false,message:'Verification code is required'});
    const decoded=jwt.verify(challengeToken,process.env.JWT_SECRET); if(decoded.purpose!=='2fa-login') throw new Error('Invalid challenge');
    const user=await prisma.user.findUnique({where:{id:decoded.userId}}); if(!user||!user.twoFactorEnabled||!user.twoFactorSecretEnc) return res.status(401).json({success:false,message:'Two-factor authentication is not enabled'});
    let valid=false; try { valid=verifyTotp(decrypt2FASecret(user.twoFactorSecretEnc),code); } catch {}
    if(!valid) valid=await consumeBackupCode(user,code);
    if(!valid) return res.status(401).json({success:false,message:'Invalid authentication code'});
    const {tokenId}=await createSessionForUser(user.id,req); const token=jwt.sign({userId:user.id,jti:tokenId},process.env.JWT_SECRET,{expiresIn:'365d'});
    res.json({success:true,message:'Login successful',data:{user:{id:user.id,username:user.username,email:user.email,phoneNumber:user.phoneNumber,fullName:user.fullName,avatarUrl:user.avatarUrl,bio:user.bio,role:user.role,status:user.status,channelNumber:user.channelNumber,channelName:user.channelName,channelCreatedAt:user.channelCreatedAt},token}});
  } catch(e){ return res.status(401).json({success:false,message:'Invalid or expired verification request'}); }
};

export const setupTwoFactor = async (req,res) => {
  try { const user=await prisma.user.findUnique({where:{id:req.userId}}); if(!user) return res.status(404).json({success:false,message:'User not found'}); if(user.twoFactorEnabled) return res.status(400).json({success:false,message:'Two-factor authentication is already enabled'});
    const secret=base32Encode(crypto.randomBytes(20)); const codes=makeBackupCodes(); await prisma.user.update({where:{id:user.id},data:{twoFactorSecretEnc:encrypt2FASecret(secret),twoFactorBackupCodes:await Promise.all(codes.map(hashBackupCode))}});
    const issuer='RA Social'; const label=encodeURIComponent(`${issuer}:${user.email}`); const otpauth=`otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    res.json({success:true,data:{secret,otpauthUri:otpauth,backupCodes:codes}});
  } catch(e){console.error('2FA setup error',e);res.status(500).json({success:false,message:'Failed to start two-factor setup'});}
};
export const enableTwoFactor = async (req,res) => { try { const {code}=req.body||{}; const user=await prisma.user.findUnique({where:{id:req.userId}}); if(!user?.twoFactorSecretEnc) return res.status(400).json({success:false,message:'Start 2FA setup first'}); if(!verifyTotp(decrypt2FASecret(user.twoFactorSecretEnc),code)) return res.status(400).json({success:false,message:'Invalid authenticator code'}); await prisma.user.update({where:{id:user.id},data:{twoFactorEnabled:true}}); res.json({success:true,message:'Two-factor authentication enabled'}); } catch(e){res.status(500).json({success:false,message:'Failed to enable two-factor authentication'});} };
export const disableTwoFactor = async (req,res) => { try { const {password,code}=req.body||{}; const user=await prisma.user.findUnique({where:{id:req.userId}}); if(!user) return res.status(404).json({success:false,message:'User not found'}); if(!(await bcrypt.compare(String(password||''),user.passwordHash))) return res.status(401).json({success:false,message:'Incorrect password'}); let valid=false; if(user.twoFactorSecretEnc) valid=verifyTotp(decrypt2FASecret(user.twoFactorSecretEnc),code); if(!valid) valid=await consumeBackupCode(user,code); if(!valid) return res.status(401).json({success:false,message:'Invalid authentication code'}); await prisma.user.update({where:{id:user.id},data:{twoFactorEnabled:false,twoFactorSecretEnc:null,twoFactorBackupCodes:[]}}); res.json({success:true,message:'Two-factor authentication disabled'}); } catch(e){res.status(500).json({success:false,message:'Failed to disable two-factor authentication'});} };
export const getTwoFactorStatus = async (req,res) => { const user=await prisma.user.findUnique({where:{id:req.userId},select:{twoFactorEnabled:true,twoFactorBackupCodes:true}}); if(!user)return res.status(404).json({success:false,message:'User not found'}); res.json({success:true,data:{enabled:user.twoFactorEnabled,backupCodesRemaining:Array.isArray(user.twoFactorBackupCodes)?user.twoFactorBackupCodes.length:0}}); };

export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true, username: true, email: true, phoneNumber: true, fullName: true, bio: true, avatarUrl: true, role: true, status: true, earnings: true,
        monetizationStatus: true, monetizationAppliedAt: true, monetizationApprovedAt: true, createdAt: true,
        channelNumber: true, channelName: true, channelCreatedAt: true,
        posts: { select: { id: true, content: true, mediaUrl: true, mediaType: true, isCreatorAd: true, status: true, viewCount: true, createdAt: true, likes: { select: { id: true } }, comments: { select: { id: true } } }, orderBy: { createdAt: 'desc' } },
        _count: { select: { followers: true, following: true } }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { _count, ...rest } = user;
    res.json({
      success: true,
      data: { ...rest, postsCount: user.posts.length, followersCount: _count.followers, followingCount: _count.following }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user data' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { fullName, bio, avatarUrl, phoneNumber } = req.body;
    const userId = req.userId;

    const data = { fullName, bio };
    if (avatarUrl) data.avatarUrl = avatarUrl;
    if (phoneNumber !== undefined) {
      const normalizedPhone = phoneNumber ? String(phoneNumber).replace(/\D/g, '') : null;
      if (normalizedPhone) {
        const duplicate = await prisma.user.findFirst({
          where: { phoneNumber: normalizedPhone, NOT: { id: userId } },
          select: { id: true }
        });
        if (duplicate) {
          return res.status(409).json({ success: false, message: 'This phone number is already linked to another account' });
        }
      }
      data.phoneNumber = normalizedPhone;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, username: true, fullName: true, bio: true, avatarUrl: true, phoneNumber: true }
    });

    res.json({ success: true, message: 'Profile updated successfully', data: user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

// Password reset OTPs are random, short-lived and stored only as bcrypt hashes.
// Production delivery is handled by the configured email/SMS provider.
export const forgotPassword = async (req, res) => {
  try {
    const identifier = String(req.body?.identifier || '').trim();
    if (!identifier) return res.status(400).json({ success: false, message: 'Email, mobile or username is required' });
    const normalizedPhone = identifier.replace(/\D/g, '');
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier.toLowerCase() }, { username: identifier }, ...(normalizedPhone ? [{ phoneNumber: normalizedPhone }] : [])] },
      select: { id: true, email: true, phoneNumber: true },
    });
    if (!user) return res.json({ success: true, message: 'If an account matches, reset instructions will be sent.' });

    const otp = String(crypto.randomInt(100000, 1000000));
    const otpHash = await bcrypt.hash(otp, 10);
    const challenge = await prisma.passwordResetChallenge.create({
      data: { userId: user.id, otpHash, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
      select: { id: true },
    });
    const devMode = process.env.NODE_ENV !== 'production' && process.env.PASSWORD_RESET_DEV_MODE === 'true';
    let delivery = null;
    if (!devMode) delivery = await sendPasswordResetCode({ user, otp });

    res.json({ success: true, message: devMode ? 'OTP generated in development mode.' : 'If an account matches, reset instructions will be sent.', data: { challengeId: challenge.id, ...(devMode ? { devOtp: otp } : {}), ...(delivery ? { delivery } : {}) } });
  } catch (error) {
    console.error('Forgot password error:', error);
    if (error.message?.includes('not configured') || error.message?.includes('Resend email failed') || error.message?.includes('Twilio SMS failed')) return res.status(503).json({ success: false, message: 'Password reset delivery service is not configured correctly.' });
    res.status(500).json({ success: false, message: 'Failed to process request' });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { identifier, otp, challengeId } = req.body;
    if (!identifier || !otp || !challengeId) return res.status(400).json({ success: false, message: 'Identifier, OTP and challenge are required' });
    const challenge = await prisma.passwordResetChallenge.findUnique({ where: { id: challengeId } });
    if (!challenge || challenge.usedAt || challenge.verifiedAt || challenge.expiresAt < new Date() || challenge.attempts >= 5) return res.status(401).json({ success: false, message: 'OTP expired, locked or already used' });
    const valid = await bcrypt.compare(String(otp), challenge.otpHash);
    if (!valid) {
      const nextAttempts = challenge.attempts + 1;
      await prisma.passwordResetChallenge.update({ where: { id: challenge.id }, data: { attempts: nextAttempts, ...(nextAttempts >= 5 ? { usedAt: new Date() } : {}) } });
      return res.status(400).json({ success: false, message: nextAttempts >= 5 ? 'Too many invalid OTP attempts. Please request a new code.' : 'Invalid OTP' });
    }
    const normalizedPhone = String(identifier).replace(/\D/g, '');
    const user = await prisma.user.findFirst({ where: { id: challenge.userId, OR: [{ email: String(identifier).toLowerCase() }, { username: identifier }, ...(normalizedPhone ? [{ phoneNumber: normalizedPhone }] : [])] }, select: { id:true } });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid reset request' });
    await prisma.passwordResetChallenge.update({ where: { id: challenge.id }, data: { verifiedAt: new Date() } });
    const resetToken = jwt.sign({ userId: user.id, purpose: 'reset', challengeId: challenge.id }, process.env.JWT_SECRET, { expiresIn: '10m' });
    res.json({ success: true, message: 'OTP verified', data: { resetToken } });
  } catch (error) { console.error('Verify OTP error:', error); res.status(500).json({ success: false, message: 'Failed to verify OTP' }); }
};

// POST /api/auth/reset-password
export const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ success: false, message: 'Reset token and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Reset link expired, please try again' });
    }

    if (decoded.purpose !== 'reset' || !decoded.challengeId) {
      return res.status(401).json({ success: false, message: 'Invalid reset token' });
    }

    const challenge = await prisma.passwordResetChallenge.findUnique({ where: { id: decoded.challengeId } });
    if (!challenge || challenge.userId !== decoded.userId || !challenge.verifiedAt || challenge.usedAt || challenge.expiresAt < new Date()) {
      return res.status(401).json({ success: false, message: 'Reset request is invalid or expired' });
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    await prisma.$transaction([
      prisma.user.update({ where: { id: decoded.userId }, data: { passwordHash } }),
      prisma.passwordResetChallenge.update({ where: { id: decoded.challengeId }, data: { usedAt: new Date() } }),
      prisma.session.updateMany({ where: { userId: decoded.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
};

// PUT /api/auth/change-password  (for logged-in users, Account & Security screen)
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    res.json({ success: true, message: 'Password changed successfully. Please log in again on your devices.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

// POST /api/auth/channel - create one creator channel for the logged-in user
export const createChannel = async (req, res) => {
  try {
    const userId = req.userId;
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, fullName: true, channelNumber: true, channelName: true, channelCreatedAt: true }
    });

    if (!existing) return res.status(404).json({ success: false, message: 'User not found' });

    const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
    if (currentUser?.status === 'blocked') return res.status(403).json({ success: false, message: 'Blocked users cannot create a channel' });
    if (currentUser?.role !== 'user') return res.status(403).json({ success: false, message: 'Only normal users can create a creator channel' });

    if (existing.channelNumber) {
      return res.status(409).json({ success: false, message: 'You already have a creator channel', data: existing });
    }

    let channelNumber;
    for (let i = 0; i < 10; i += 1) {
      const candidate = `RA-${crypto.randomInt(10000000, 100000000)}`;
      const taken = await prisma.user.findUnique({ where: { channelNumber: candidate }, select: { id: true } });
      if (!taken) { channelNumber = candidate; break; }
    }
    if (!channelNumber) {
      return res.status(500).json({ success: false, message: 'Could not generate a channel number. Please try again.' });
    }

    const channelName = (req.body?.channelName || existing.fullName || existing.username || 'My Channel').trim().slice(0, 80);
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { channelNumber, channelName, channelCreatedAt: new Date() },
      select: { id: true, username: true, fullName: true, channelNumber: true, channelName: true, channelCreatedAt: true }
    });

    res.status(201).json({ success: true, message: 'Creator channel created successfully', data: updated });
  } catch (error) {
    console.error('Create channel error:', error);
    res.status(500).json({ success: false, message: 'Failed to create creator channel' });
  }
};
