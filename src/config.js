// Saytdagi barcha matn va suratlar shu yerda.
// Suratlarni public/memories/ papkasiga joylang va `file` nomini moslang.
// Fayl topilmasa, uning o‘rnida namuna chiqadi.
// `big: true` surat devorda katta bo‘lib, oldiga skameyka qo‘yiladi.
// `voice: '01.m4a'` qo‘shsangiz, surat ochilganda shu ovozli xabar o‘ynaydi (public/memories/ ichida).
// Oxirgi ikki surat zal oxiridagi qora devorga osiladi.

export const SITE = {
  title: 'Bizning muzeyimiz',
  from: 'Seni sevgan inson',
  to: 'Eng aziz insonim',
  dedication: 'Bu muzeyning yagona mehmoni — sensan.',
  // Saytni ochgan odamning yonida yuradigan sherik.
  companion: { name: 'Sevgilim', gender: 'male' }, // gender: 'male' yoki 'female'
  music: null, // masalan: 'music.mp3' (public/ papkasida)
  // Hamma xotira ko‘rilgach, yurak oldida ochiladigan maktub.
  letter: {
    title: '{name}, tug‘ilgan kuning bilan!',
    body: [
      'Bu yerga o‘z so‘zlaringizni yozasiz.',
      'Har bir xat boshi alohida qatorda turadi.',
    ],
    sign: 'Seni sevgan inson',
  },
};

export const MEMORIES = [
  { file: '01.jpg', title: 'Birinchi uchrashuv', date: 'Sana', note: 'Shu kun haqida bir-ikki jumla yoziladi.' },
  { file: '02.jpg', title: 'Ikkinchi xotira', date: 'Sana', note: 'Shu kun haqida bir-ikki jumla yoziladi.' },
  { file: '03.jpg', title: 'Uchinchi xotira', date: 'Sana', note: 'Shu kun haqida bir-ikki jumla yoziladi.', big: true },
  { file: '04.jpg', title: 'To‘rtinchi xotira', date: 'Sana', note: 'Shu kun haqida bir-ikki jumla yoziladi.' },
  { file: '05.jpg', title: 'Beshinchi xotira', date: 'Sana', note: 'Shu kun haqida bir-ikki jumla yoziladi.' },
  { file: '06.jpg', title: 'Oltinchi xotira', date: 'Sana', note: 'Shu kun haqida bir-ikki jumla yoziladi.', big: true },
  { file: '07.jpg', title: 'Yettinchi xotira', date: 'Sana', note: 'Shu kun haqida bir-ikki jumla yoziladi.' },
  { file: '08.jpg', title: 'Sakkizinchi xotira', date: 'Sana', note: 'Shu kun haqida bir-ikki jumla yoziladi.' },
  { file: '09.jpg', title: 'Eng sevimli kunim', date: 'Sana', note: 'Shu kun haqida bir-ikki jumla yoziladi.' },
  { file: '10.jpg', title: 'Va bu faqat boshlanishi', date: 'Sana', note: 'Shu kun haqida bir-ikki jumla yoziladi.' },
];
