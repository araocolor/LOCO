export const PROFILE_AVATAR_UPDATED_EVENT = "loco:profile-avatar-updated";

export interface ProfileAvatarUpdatedDetail {
  nickname?: string;
  profile_image_url: string | null;
}
