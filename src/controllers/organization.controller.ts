import { Response } from 'express';
import * as orgService from '../services/organization.services';
import { AuthRequest, CreateOrganizationBody, AddMemberBody, OrgParams } from '../types/organization.types';
import { ORG_MESSAGES } from '../constants/messages';

export const createOrganization = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orgName } = req.body as CreateOrganizationBody;
    if (!orgName) {
      res.status(400).json({ error: ORG_MESSAGES.ERROR.NAME_REQUIRED });
      return;
    }
    const org = await orgService.createOrganization(orgName, req.user!.userId);
    res.status(201).json(org);
  } catch (err: any) {
    console.error("[createOrganization]", err);
    res.status(err.status || 500).json({ error: err.message || ORG_MESSAGES.ERROR.INTERNAL_SERVER });
  }
};

export const getMyOrganizations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgs = await orgService.getMyOrganizations(req.user!.userId);
    res.json(orgs);
  } catch (err: any) {
    console.error("[getMyOrganizations]", err);
    res.status(500).json({ error: err.message || ORG_MESSAGES.ERROR.INTERNAL_SERVER });
  }
};

export const getMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Safety: try both 'id' and 'orgId' based on what's in your routes file
    const id = req.params.orgId || req.params.id;
    const numericOrgId = Number(id);

    if (!id || isNaN(numericOrgId)) {
      res.status(400).json({ error: "Invalid or missing Organization ID" });
      return;
    }

    const members = await orgService.getMembers(numericOrgId);
    res.json(members);
  } catch (err: any) {
    console.error("[getMembers]", err);
    res.status(500).json({ error: err.message || ORG_MESSAGES.ERROR.INTERNAL_SERVER });
  }
};

export const addMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.body as AddMemberBody;
    const id = req.params.orgId || req.params.id;
    const numericOrgId = Number(id);
    const numericUserId = Number(userId);

    if (!id || isNaN(numericOrgId) || isNaN(numericUserId)) {
      res.status(400).json({ error: "Valid Organization ID and User ID are required" });
      return;
    }

    const user = await orgService.addMember(numericOrgId, numericUserId);
    res.status(201).json(user);
  } catch (err: any) {
    console.error("[addMember]", err);
    res.status(err.status || 500).json({ error: err.message || ORG_MESSAGES.ERROR.INTERNAL_SERVER });
  }
};

export const deleteOrganization = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log("Full Params:", req.params);
    const { orgId } = req.params; 
    
    console.log("Incoming orgId from params:", orgId); // Debugging line

    const numericOrgId = parseInt(orgId as string, 10);

    if (!orgId || isNaN(numericOrgId)) {
      res.status(400).json({ error: "Valid Organization ID is required" });
      return;
    }

    await orgService.deleteOrganization(numericOrgId, req.user!.userId);
    res.json({ message: 'Organization deleted' });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || "Internal server error" });
  }
};
