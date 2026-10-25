// Guides are written by the team and reviewed before publishing. Each guide answers
// a question people ask about watching anime.
export type GuideTranslation = {
  title: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
};

export type Guide = {
  slug: string;
  updated: string;
  translations: Partial<Record<"th" | "en" | "ja", GuideTranslation>>;
};

export const GUIDES: Guide[] = [
  {
    slug: "what-is-watch-order",
    updated: "2026-10-25",
    translations: {
      th: {
        title: "ลำดับการดูอนิเมะคืออะไร",
        intro: "เรื่องหลายเรื่องมีภาค ตอนพิเศษ และภาคเสริม ลำดับการดูช่วยให้ดูตามลำดับเรื่องที่ผู้สร้างตั้งใจ",
        sections: [
          {
            heading: "ลำดับตามวันฉาย",
            body: ["ดูตามวันที่ออกอากาศครั้งแรก เหมาะกับคนที่อยากดูตามเวลาจริงของผู้สร้าง"],
          },
          {
            heading: "ลำดับตามเนื้อเรื่อง",
            body: ["ดูตามช่วงเวลาในเรื่อง บางครั้งภาคก่อนหน้าเป็นเรื่องย้อนอดีต ซึ่งทำให้ลำดับต่างจากวันฉาย"],
          },
          {
            heading: "ดูรายการที่มีสปอยล์",
            body: ["หน้าลำดับการดูซ่อนรายการที่มีสปอยล์ไว้ก่อน ถ้าไม่อยากรู้เนื้อเรื่องล่วงหน้า ให้ดูเฉพาะรายการที่ไม่มีป้ายสปอยล์"],
          },
        ],
      },
      en: {
        title: "What is a watch order?",
        intro: "Many series have seasons, specials and side stories. A watch order lists them in the sequence that makes the story easiest to follow.",
        sections: [
          {
            heading: "Release order",
            body: ["Watch in the order they first aired. This matches how the creators released the series."],
          },
          {
            heading: "Story order",
            body: ["Watch in the order the events happen in the story. A prequel can air later but come first in the timeline."],
          },
          {
            heading: "Spoiler entries",
            body: ["The watch-order page hides spoiler entries by default. If you want to avoid spoilers, skip the entries marked as spoilers."],
          },
        ],
      },
    },
  },
  {
    slug: "reading-airing-times-in-thailand",
    updated: "2026-10-25",
    translations: {
      th: {
        title: "อ่านเวลาฉายอนิเมะเป็นเวลาไทยอย่างไร",
        intro: "อนิเมะมักออกอากาศตามเวลาท้องถิ่นของญี่ปุ่น ซึ่งเร็วกว่าประเทศไทย 2 ชั่วโมง",
        sections: [
          {
            heading: "เวลาที่แสดงในเว็บ",
            body: ["ตารางฉายทั้งหมดแสดงตามเวลาประเทศไทยเป็นค่าเริ่มต้น คุณเปลี่ยนเขตเวลาได้ในหน้าตารางฉาย"],
          },
          {
            heading: "เวลาเลื่อน",
            body: ["บางครั้งสถานีเลื่อนการฉาย เว็บจะบันทึกการเปลี่ยนแปลงในประวัติของตอนนั้น และแจ้งเตือนผู้ที่ติดตามเรื่อง"],
          },
        ],
      },
      en: {
        title: "How to read airing times in Thailand",
        intro: "Anime is usually broadcast on Japanese local time, which is two hours ahead of Thailand.",
        sections: [
          {
            heading: "Times shown on this site",
            body: ["All schedules default to Thai time. You can change the time zone on the schedule page."],
          },
          {
            heading: "Delays",
            body: ["Sometimes a broadcaster moves an episode. We keep a history of each change on the episode page and notify people who follow the title."],
          },
        ],
      },
    },
  },
];

export function findGuide(slug: string): Guide | null {
  return GUIDES.find((guide) => guide.slug === slug) ?? null;
}
