"use client";

export default function RefundPolicyContent() {
  return (
    <div className="text-[13px] leading-[22px] text-gray-700">
      <p className="mb-1 text-[12px] text-gray-400">최종 업데이트 : 2026년 6월 9일</p>
      <p className="mb-4">
        XLATIN은 AI 기반 이미지 및 포스터 생성 서비스로서 크레딧 충전 방식을 사용합니다.
      </p>
      <p className="mb-6">
        회원은 결제 전에 본 환불정책을 충분히 확인한 후 서비스를 이용하여야 합니다.
      </p>

      <Section title="1. 환불 가능 대상">
        <p className="mb-2">다음의 경우 환불이 가능합니다.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>중복 결제가 발생한 경우</li>
          <li>시스템 오류로 서비스 이용이 불가능한 경우</li>
          <li>회사의 귀책사유로 정상적인 서비스 제공이 불가능한 경우</li>
        </ul>
      </Section>

      <Section title="2. 환불 불가 대상">
        <p className="mb-2">다음의 경우 환불이 제한될 수 있습니다.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>이미 사용된 크레딧</li>
          <li>무료 지급 크레딧</li>
          <li>이벤트 또는 프로모션으로 지급된 크레딧</li>
          <li>회원의 약관 위반으로 이용이 제한된 경우</li>
          <li>관계 법령상 환불 제한 사유가 존재하는 경우</li>
        </ul>
      </Section>

      <Section title="3. AI 이미지 생성 서비스의 특성">
        <p>회원이 크레딧을 사용하여 AI 이미지 또는 포스터를 생성한 경우 해당 크레딧은 사용된 것으로 간주됩니다.</p>
        <p className="mt-2">생성 결과물이 회원의 기대와 다르다는 사유만으로는 환불 사유가 되지 않습니다.</p>
        <p className="mt-2">AI 서비스 특성상 결과물의 품질, 스타일, 구성은 입력 내용에 따라 달라질 수 있습니다.</p>
      </Section>

      <Section title="4. 환불 신청 방법">
        <p>환불을 원하는 회원은 고객센터 또는 회사가 제공하는 문의 채널을 통해 신청할 수 있습니다.</p>
        <p className="mt-2">환불 신청 시 본인 확인 및 결제 정보 확인이 필요할 수 있습니다.</p>
      </Section>

      <Section title="5. 환불 처리 기간">
        <p>환불이 승인된 경우 회사는 관련 법령이 정한 기간 내에 환불을 진행합니다.</p>
        <p className="mt-2">실제 환불 완료 시점은 카드사, 카카오페이, 금융기관 등 결제수단 제공자의 정책에 따라 달라질 수 있습니다.</p>
      </Section>

      <Section title="6. 크레딧 유효기간">
        <p>유상 크레딧의 유효기간은 충전일로부터 5년입니다.</p>
        <p className="mt-2">무료 크레딧 및 이벤트 크레딧은 별도로 고지된 유효기간이 적용될 수 있습니다.</p>
      </Section>

      <Section title="7. 고객센터">
        <ul className="space-y-1">
          <li>상호 : 아라오(ARAO)</li>
          <li>서비스명 : XLATIN</li>
          <li>이메일 : jejusalsa@gmail.com</li>
          <li>문의 접수 : 24시간</li>
          <li>답변 : 영업일 기준 1~3일 이내</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-[14px] font-bold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}
