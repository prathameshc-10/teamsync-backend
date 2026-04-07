// src/constants/messages.ts

export const JWT_MESSAGES = {
  ACCESS_TOKEN_SECRET: "access_secret_change_in_production",
  REFRESH_TOKEN_SECRET: "refresh_secret_change_in_production",
} as const;

export const AUTH_MESSAGES = {
  REGISTRATION_OTP_SENT: "OTP sent to your email. Please verify to complete registration.",
  REGISTRATION_COMPLETE: "Email verified. Registration complete.",
  REGISTRATION_FAILED: "Registration failed",

  NAME_REQUIRED:"Name is required",

  LOGIN_OTP_SENT: "OTP sent to your email",
  LOGIN_SUCCESS: "Login successful",
  LOGIN_FAILED: "Login failed",

  OTP_INVALID: "Invalid or expired OTP",
  OTP_FAILED: "OTP verification failed",

  NO_TOKEN: "No token provided",
  TOKEN_EXPIRED: "Token expired — please refresh",
  TOKEN_INVALID: "Invalid token",
  TOKEN_REFRESHED: "Token refreshed",
  REFRESH_TOKEN_MISSING: "No refresh token",
  REFRESH_TOKEN_INVALID: "Invalid or expired refresh token",

  LOGOUT_SUCCESS: "Logged out successfully",
  NO_ADMIN_ACCESS: "Forbidden: admin access only",

  UNAUTHORIZED: "Unauthorized",
  USER_NOT_FOUND: "User not found",
  SERVER_ERROR: "Server error",

  EMAIL_REQUIRED: "email and password are required",
  OTP_FIELDS_REQUIRED: "email and otp are required",
  REGISTER_FIELDS_REQUIRED: "email, otp, name and password are required",

  EMAIL_EXISTS:"Email already registered",
  EMAIL_INVALID:"Invalid email or password",
  NOT_VERIFIED:"Account not verified",

  OTP_VERIFIED: "Email verified successfully. Please set your password.",
  EMAIL_NOT_VERIFIED: "Email not verified. Please complete OTP verification first.",

  FORGOT_PASSWORD_OTP_SENT: "Password reset OTP sent to your email",
  FORGOT_PASSWORD_FAILED: "Failed to send reset OTP",
  FORGOT_OTP_VERIFIED: "OTP verified. Use the reset token to set a new password.",
  FORGOT_OTP_FAILED: "OTP verification failed",
  PASSWORD_RESET_SUCCESS: "Password reset successful. Please login.",
  RESET_PASSWORD_FAILED: "Password reset failed",
  RESET_TOKEN_INVALID: "Invalid or expired reset token",
  EMAIL_NOT_FOUND: "No account found with this email",
  FORGOT_PASSWORD_FIELDS_REQUIRED: "email is required",
  VERIFY_FORGOT_OTP_FIELDS_REQUIRED: "email and otp are required",
  RESET_PASSWORD_FIELDS_REQUIRED: "resetToken and newPassword are required",
} as const;

export const USER_MESSAGES = {
  USER_CREATED: "User created successfully",
  USER_CREATE_FAILED: "Failed to create user",
  USER_FIELDS_REQUIRED: "name, email and password are required",
  NOT_FOUND:"User not found"
} as const;

export const SEED_MESSAGES = {
  ADMIN_EXISTS: "[SEED] Admin user already exists",
  ADMIN_CREATED: "[SEED] Admin user created → admin@primaverse.com / Admin@123",
} as const;

export const DEPARTMENT_MESSAGES = {
  CREATED: "Department created successfully",
  UPDATED: "Department updated successfully",
  DELETED: "Department deactivated successfully",
  FETCHED: "Departments fetched successfully",
  FETCHED_ONE: "Department fetched successfully",
  NOT_FOUND: "Department not found",
  ALREADY_EXISTS: "Department with this name already exists",
  CREATE_FAILED: "Failed to create department",
  UPDATE_FAILED: "Failed to update department",
  DELETE_FAILED: "Failed to deactivate department",
  FETCH_FAILED: "Failed to fetch departments",
  FIELDS_REQUIRED: "name, pointOfContactId, annualBudget and goalsAndVision are required",
} as const;

export const JOB_ROLE_MESSAGES = {
  FIELDS_REQUIRED:  "All required fields must be provided",
  CREATED:          "Job role created successfully",
  CREATE_FAILED:    "Failed to create job role",
  FETCHED:          "Job roles fetched successfully",
  FETCHED_ONE:      "Job role fetched successfully",
  FETCH_FAILED:     "Failed to fetch job role",
  UPDATED:          "Job role updated successfully",
  UPDATE_FAILED:    "Failed to update job role",
  TOGGLED:          "Job role status toggled successfully",
  DELETED:          "Job role deleted successfully",
  DELETE_FAILED:    "Failed to delete job role",
  NOT_FOUND:            "Job role not found",
  DEPARTMENT_NOT_FOUND: "Department not found",
  INVALID_SALARY_RANGE: "salaryMin cannot be greater than salaryMax",
  ALREADY_EXISTS:       "Job role already exists",
  INVALID_JOB_ROLE:  "Invalid job role id",
  INVALID_DEPARTMENT: "Invalid department"
} as const;

export const DEPARTMENT_VALIDATION = {
  NAME_REQUIRED:             "Name is required",
  POC_REQUIRED:              "Point of contact is required",
  ANNUAL_BUDGET_POSITIVE:    "Annual budget must be positive",
  GOALS_REQUIRED:            "Goals and vision is required",
} as const;

export const JOB_ROLE_VALIDATION = {
  TITLE_REQUIRED:       "Title is required",
  DEPARTMENT_REQUIRED:  "Department is required",
  JOB_DETAILS_REQUIRED: "Job details are required",
  SALARY_MIN_REQUIRED:  "Salary min is required",
  SALARY_MAX_REQUIRED:  "Salary max must be positive",
  HIRE_DATE_REQUIRED:   "Target hire date is required",
} as const;

export const ROLE_VALIDATION = {
  ACCESS_DENIED: "Access denied: insufficient permissions"
} as const;

export const USER_VALIDATION ={
  INVALID_USER: "Failed to create user",
  FAILED_TO_FETCH: "Failed to fetch users",
  NOT_FOUND: "User not found",
  SERVER_ERROR:"Server error",
  USER_UPDATED: "User updated",
  FAILED_TO_UPDATE: "Failed to update user",
  USER_DELETED: "User deleted",
  FAILED_TO_DELETE: "Failed to delete user",
  FAILED_TO_FETCH_HR: "Failed to fetch HRs",
  FAILED_TO_FETCH_MANAGER: "Failed to fetch managers" 
} as const;