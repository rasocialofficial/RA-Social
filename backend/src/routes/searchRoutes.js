import express from 'express';
import { search } from '../controllers/searchController.js';
import { getHashtag } from '../controllers/hashtagController.js';

const router = express.Router();

router.get('/hashtag/:name', getHashtag);
router.get('/', search);

export default router;
