export interface CreateConversationBody {
  type?: "direct" | "group";
  orgId?: number;
  memberUserIds: number[];
}

export interface AddMemberBody {
  userId: number;
}