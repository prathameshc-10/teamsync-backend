import { Response } from 'express';
import * as orgService from '../services/organization.services';
import { AuthRequest, CreateOrganizationBody, AddMemberBody, OrgParams } from '../types/organization.types';

export const createOrganization = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orgName } = req.body as CreateOrganizationBody;
    if (!orgName) {
      res.status(400).json({ error: 'Organization name is required' });
      return;
    }

    const org = await orgService.createOrganization(orgName, req.user!.userId);
    res.status(201).json(org);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const getMyOrganizations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgs = await orgService.getMyOrganizations(req.user!.userId);
    res.json(orgs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orgId } = req.params as unknown as OrgParams;
    const members = await orgService.getMembers(parseInt(orgId));
    res.json(members);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const addMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.body as AddMemberBody;
    const { orgId } = req.params as unknown as OrgParams;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const user = await orgService.addMember(parseInt(orgId), userId);
    res.status(201).json(user);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
};