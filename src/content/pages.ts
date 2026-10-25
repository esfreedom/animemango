// Static pages. Every legal page is marked as a draft until a Thai lawyer reviews it
// (DESIGN.md section 13).
export type StaticPage = {
  title: string;
  body: string[];
};

export type StaticPageKey = "about" | "terms" | "privacy";

export const STATIC_PAGES: Record<StaticPageKey, Record<"th" | "en" | "ja", StaticPage>> = {
  about: {
    th: {
      title: "เกี่ยวกับ AnimeHub",
      body: [
        "AnimeHub รวบรวมข้อมูลอนิเมะ ตารางฉายตามเวลาไทย ข้อมูลว่าดูได้ที่ไหนในประเทศไทย และกระทู้รายตอนที่เขียนได้หลายภาษา",
        "เราไม่โฮสต์หรือฉายวิดีโอตอนอนิเมะ ลิงก์ไปยังวิดีโอมีเฉพาะตัวอย่างจากช่องทางการที่ตรวจสอบแล้ว และลิงก์ไปยังแพลตฟอร์มที่มีสิทธิ์จริง",
      ],
    },
    en: {
      title: "About AnimeHub",
      body: [
        "AnimeHub collects anime information, airing schedules in Thai time, where to watch in Thailand, and multilingual episode threads.",
        "We do not host or stream anime episodes. Video links are limited to trailers from verified official channels and links to platforms that have the rights.",
      ],
    },
    ja: {
      title: "AnimeHubについて",
      body: [
        "AnimeHubは、アニメ情報、タイ時間の放送スケジュール、タイでの配信状況、多言語のエピソードスレッドをまとめています。",
        "アニメ本編の動画はホストもストリーミングもしていません。動画リンクは、確認済みの公式チャンネルのPVと、権利を持つ配信先へのリンクに限ります。",
      ],
    },
  },
  terms: {
    th: {
      title: "ข้อตกลงการใช้งาน",
      body: [
        "ร่างนี้รอการตรวจทานทางกฎหมายก่อนเผยแพร่อย่างเป็นทางการ",
        "ผู้ใช้ต้องไม่โพสต์เนื้อหาที่ละเมิดลิขสิทธิ์ ข้อความที่ก่อกวน หรือเนื้อหาที่ผิดกฎหมาย ทีมงานอาจซ่อนหรือลบความเห็นที่ฝ่าฝืน",
        "หากคุณเป็นเจ้าของลิขสิทธิ์และพบเนื้อหาที่ละเมิด แจ้งได้ที่หน้าแจ้งลบเนื้อหา",
      ],
    },
    en: {
      title: "Terms of Use",
      body: [
        "This is a draft awaiting legal review before official publication.",
        "Do not post content that infringes copyright, abusive messages, or anything illegal. Moderators may hide or remove comments that break these rules.",
        "If you own the rights to content and find an infringement, use the report removal page.",
      ],
    },
    ja: {
      title: "利用規約",
      body: [
        "この文書は正式公開の前に法務確認が必要な草案です。",
        "著作権を侵害する投稿、迷惑な投稿、違法な内容は禁止します。管理者は規約に違反するコメントを非表示または削除することがあります。",
        "権利を持つコンテンツが侵害されている場合は、削除申請ページからご連絡ください。",
      ],
    },
  },
  privacy: {
    th: {
      title: "นโยบายความเป็นส่วนตัว",
      body: [
        "ร่างนี้รอการตรวจทานทางกฎหมายก่อนเผยแพร่อย่างเป็นทางการ",
        "เราเก็บอีเมลเพื่อส่งลิงก์เข้าสู่ระบบ และเก็บชื่อผู้ใช้ ความเห็น และการกระทำในระบบ เช่น การติดตามและการโหวต ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562",
        "เราไม่แสดงอีเมลของผู้ใช้ต่อสาธารณะ",
      ],
    },
    en: {
      title: "Privacy Policy",
      body: [
        "This is a draft awaiting legal review before official publication.",
        "We store your email to send sign-in links, and your username, comments and actions such as follows and votes. Your email is never shown publicly.",
      ],
    },
    ja: {
      title: "プライバシーポリシー",
      body: [
        "この文書は正式公開の前に法務確認が必要な草案です。",
        "ログインリンクを送るためにメールアドレスを保存し、ユーザー名、コメント、フォローや投票などの操作を保存します。メールアドレスは公開しません。",
      ],
    },
  },
};
