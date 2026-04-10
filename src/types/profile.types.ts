export interface ProfileResponse {
  userId: number;
  email: string;
  fullName: string;
  isVerified: boolean;
  createdAt: Date;
  organizations: {
    orgId: number;
    orgName: string;
    createdAt: Date;
    isActive: boolean;
  }[];
}

export interface UpdateProfileBody {
  fullName: string;
  email: string;
}

export interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}