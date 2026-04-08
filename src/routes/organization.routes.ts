import { Router } from 'express';
import {
  createOrganization,
  getMyOrganizations,
  getMembers,
  addMember,
} from '../controllers/organization.controller';
import { verifyAccessToken } from '../middleware/auth.middleware';

const router: Router = Router();

router.use(verifyAccessToken);
router.post('/', createOrganization);
router.get('/', getMyOrganizations);
router.get('/:orgId/members', getMembers);
router.post('/:orgId/members', addMember);

export default router;