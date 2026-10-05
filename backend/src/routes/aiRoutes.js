import express from 'express';
import {
  chatWithAI,
  deepResearch,
  uploadAIFile,
  listAIConversations,
  getAIConversation,
  deleteAIConversation,
  aiUpload,
  analyzeAIFiles,
  codingAI,
  dataAI,
  writingAI,
  socialAI,
  creativeAI,
  videoAI,
  transcribeAI,
  listAIMemories,
  saveAIMemory,
  deleteAIMemory,
  aiCapabilities,
  aiHealth,
  aiUsage,
  generateAIImage, editAIImage,
  generateAIVideo
} from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/capabilities', protect, aiCapabilities);
router.get('/health', protect, aiHealth);
router.get('/usage', protect, aiUsage);
router.post('/generate-image', protect, generateAIImage);
router.post('/edit-image', protect, aiUpload.single('image'), editAIImage);
router.post('/generate-video', protect, generateAIVideo);
router.get('/history', protect, listAIConversations);
router.get('/history/:id', protect, getAIConversation);
router.delete('/history/:id', protect, deleteAIConversation);
router.post('/upload', protect, aiUpload.array('files', 6), uploadAIFile);
router.post('/research', protect, deepResearch);
router.post('/file-analyze', protect, aiUpload.array('files', 6), analyzeAIFiles);
router.post('/coding', protect, codingAI);
router.post('/data-analysis', protect, dataAI);
router.post('/writing', protect, writingAI);
router.post('/social', protect, socialAI);
router.post('/creative', protect, creativeAI);
router.post('/video', protect, videoAI);
router.post('/transcribe', protect, aiUpload.single('audio'), transcribeAI);
router.get('/memory', protect, listAIMemories);
router.post('/memory', protect, saveAIMemory);
router.delete('/memory/:id', protect, deleteAIMemory);
router.post('/chat', protect, chatWithAI);

export default router;
