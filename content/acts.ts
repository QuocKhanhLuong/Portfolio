import type { Act } from './types';

/**
 * The eight acts. Editing copy here changes the site; nothing else needs to move.
 *
 * `weight` is scroll length. It is the only pacing control — Act 04 is the
 * longest because it is the one the whole thing is built around, and Act 00 is
 * short because silence stops working if you hold it too long.
 */
export const ACTS: Act[] = [
  {
    id: 'signal',
    index: '00',
    label: 'SIGNAL',
    weight: 1.0,
    states: ['signal'],
    align: 'center',
    redaction: 'resolve',
    headline: {
      en: "We don't see the world all at once.",
      vi: 'Chúng ta không nhìn thấy thế giới cùng một lúc.',
    },
    lead: {
      en: 'Light arrives as a signal before it arrives as a scene. Something has to build the rest.',
      vi: 'Ánh sáng đến như một tín hiệu trước khi trở thành một khung cảnh. Phần còn lại phải được dựng lên.',
    },
  },
  {
    id: 'curiosity',
    index: '01',
    label: 'CURIOSITY',
    weight: 1.6,
    states: ['pixel', 'image'],
    align: 'left',
    redaction: 'resolve',
    headline: {
      en: 'I wanted to know how a machine learns to see.',
      vi: 'Tôi muốn biết một cỗ máy học nhìn bằng cách nào.',
    },
    lead: {
      en: 'Not whether it could. How. What has to happen between a number and a recognition.',
      vi: 'Không phải liệu nó có thể. Mà bằng cách nào. Điều gì phải xảy ra giữa một con số và một sự nhận ra.',
    },
    body: {
      en: [
        'The first thing I built read an image one value at a time and guessed. It was wrong almost always, and the way it was wrong was more interesting than the times it was right.',
      ],
      vi: [
        'Thứ đầu tiên tôi viết đọc một bức ảnh từng giá trị một rồi đoán. Nó sai gần như mọi lần, và cách nó sai thú vị hơn những lần nó đúng.',
      ],
    },
  },
  {
    id: 'representation',
    index: '02',
    label: 'REPRESENTATION',
    weight: 1.3,
    states: ['features'],
    align: 'right',
    headline: {
      en: 'I learned that pixels were never the point.',
      vi: 'Tôi nhận ra điểm ảnh chưa bao giờ là điều quan trọng.',
    },
    lead: {
      en: 'What a model keeps is not the image. It is what the image was evidence of.',
      vi: 'Thứ một mô hình giữ lại không phải bức ảnh. Mà là thứ bức ảnh đó làm bằng chứng.',
    },
  },
  {
    id: 'depth',
    index: '03',
    label: 'DEPTH',
    weight: 1.5,
    states: ['cloud'],
    align: 'left',
    headline: {
      en: "Then I realised the world wasn't flat.",
      vi: 'Rồi tôi nhận ra thế giới không phẳng.',
    },
    lead: {
      en: 'A photograph is a shadow of geometry. Gather enough of them and the geometry comes back.',
      vi: 'Một bức ảnh là cái bóng của hình học. Gom đủ nhiều, hình học quay trở lại.',
    },
  },
  {
    id: 'consequence',
    index: '04',
    label: 'CONSEQUENCE',
    weight: 2.2,
    states: ['volume', 'human'],
    align: 'right',
    headline: {
      en: 'Seeing something and understanding why it matters are very different problems.',
      vi: 'Nhìn thấy một điều và hiểu vì sao điều đó quan trọng là hai bài toán rất khác nhau.',
    },
    lead: {
      en: 'A boundary drawn correctly on a scan is still only a boundary. Someone has to live on one side of it.',
      vi: 'Một đường biên vẽ đúng trên ảnh chụp vẫn chỉ là một đường biên. Có người phải sống ở một phía của nó.',
    },
  },
  {
    id: 'uncertainty',
    index: '05',
    label: 'UNCERTAINTY',
    weight: 1.4,
    states: ['uncertainty'],
    align: 'left',
    redaction: 'dissolve',
    headline: {
      en: 'The deeper I went, the less certain the answers became.',
      vi: 'Càng đi sâu, các câu trả lời càng bớt chắc chắn.',
    },
    lead: {
      en: 'The models that worried me were not the wrong ones. They were the confident ones.',
      vi: 'Những mô hình khiến tôi lo không phải mô hình sai. Mà là mô hình tự tin.',
    },
  },
  {
    id: 'frontier',
    index: '06',
    label: 'FRONTIER',
    weight: 1.4,
    states: ['graph'],
    align: 'center',
    headline: {
      en: 'So I stopped looking for finished answers.',
      vi: 'Nên tôi thôi tìm những câu trả lời đã hoàn tất.',
    },
    lead: {
      en: 'The questions turned out to be connected. Working on one moves the others.',
      vi: 'Hoá ra các câu hỏi nối với nhau. Làm việc với một câu làm dịch chuyển những câu còn lại.',
    },
  },
  {
    id: 'return',
    index: '07',
    label: 'RETURN',
    weight: 1.8,
    states: ['constellation'],
    align: 'center',
    headline: {
      en: "I'm still learning how to see.",
      vi: 'Tôi vẫn đang học cách nhìn.',
    },
  },
];

/** Contact, shown once, at the end. */
export const CONTACT = {
  invitation: {
    en: 'If you are working on something in this direction, I would like to hear about it.',
    vi: 'Nếu bạn đang làm điều gì đó theo hướng này, tôi muốn được nghe.',
  },
  links: [
    { label: 'EMAIL', href: 'mailto:khanhlq.hust.work@gmail.com' },
    { label: 'GITHUB', href: 'https://github.com/QuocKhanhLuong' },
    { label: 'SCHOLAR', href: '#' },
    { label: 'LINKEDIN', href: '#' },
    { label: 'CV', href: '#' },
  ],
};
