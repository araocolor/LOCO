export const PROFILE_AVATAR_UPDATED_EVENT = "loco:profile-avatar-updated";
export const PROFILE_EDIT_OPEN_EVENT = "loco:profile-edit-open";

export interface ProfileAvatarUpdatedDetail {
  nickname?: string;
  profile_image_url: string | null;
}
