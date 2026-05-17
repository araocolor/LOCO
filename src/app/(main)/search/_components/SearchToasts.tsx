interface SearchToastsProps {
  showBlackReportToast: boolean;
  showHideFriendToast: boolean;
  friendLinkedNickname: string | null;
  followingCancelledNickname: string | null;
}

export default function SearchToasts({
  showBlackReportToast,
  showHideFriendToast,
  friendLinkedNickname,
  followingCancelledNickname,
}: SearchToastsProps) {
  return (
    <>
      {showBlackReportToast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 text-white rounded-full px-5 py-3 text-[15px] font-semibold animate-fade-in-out">
            블랙신고완료
          </div>
        </div>
      )}
      {showHideFriendToast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 text-white rounded-full px-5 py-3 text-[15px] font-semibold animate-fade-in-out">
            해당 회원을 친구관리로 이동하였습니다.
          </div>
        </div>
      )}
      {friendLinkedNickname && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 text-white rounded-full px-5 py-3 text-[15px] font-semibold animate-fade-in-out">
            {friendLinkedNickname}님과 이제 친구가 되었습니다.
          </div>
        </div>
      )}
      {followingCancelledNickname && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 text-white rounded-full px-5 py-3 text-[15px] font-semibold animate-fade-in-out">
            {followingCancelledNickname}님에 팔로잉이 취소되었습니다.
          </div>
        </div>
      )}
    </>
  );
}
