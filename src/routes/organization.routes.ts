import { Router } from 'express';
import {
  createOrganization,
  getMyOrganizations,
  getMembers,
  addMember,
  deleteOrganization,
  getOrgChat,
  sendOrgChatMessage
} from '../controllers/organization.controller';
import { verifyAccessToken } from '../middleware/auth.middleware';

const router: Router = Router();

router.use(verifyAccessToken);
router.post('/', createOrganization);
router.get('/', getMyOrganizations);
router.get('/:orgId/members', getMembers);
router.post('/:orgId/members', addMember);
router.get('/:orgId/chat', getOrgChat);
router.post('/:orgId/chat/messages', sendOrgChatMessage);
router.delete('/:orgId', deleteOrganization);

export default router;