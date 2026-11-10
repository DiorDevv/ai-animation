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
  // gender: 'opposite' — mehmon tanlaganining teskarisi; yoki aniq 'male' / 'female'.
  companion: { name: 'Sevgilim', gender: 'opposite' },
  // Birga o‘tgan vaqt hisoblagichi. NAMUNA SANA: tanishgan kuningizga almashtiring.
  together: { since: '2024-02-14T18:00:00' },
  // Terrasadagi osmon yuqoridagi sanada shu joydan qanday ko‘ringan bo‘lsa, shunday chiziladi.
  sky: { city: 'Toshkent', lat: 41.3111, lon: 69.2797, utcOffset: '+05:00' },
  // Uchar yulduz tutilganda chiqadigan tilaklar. NAMUNA: o‘zingiznikiga almashtiring.
  wishes: [
    'Har yangi kunni sen bilan boshlashni tilayman.',
    'Sening kulging hech qachon so‘nmasin.',
    'Birga qariyligimizni tilayman.',
    'Orzularing birma-bir ushalsin.',
    'Bizning hikoyamiz hech tugamasin.',
  ],
  // Stoldagi sovg'a qutisi ochilganda chiqadigan xabar. NAMUNA: o‘zingiznikiga almashtiring.
  gift: { message: 'Bu quti ichida eng qimmatli narsam bor: butun yuragim.' },
  // Osmondagi alohida yulduz. NAMUNA: o‘z xabaringizga almashtiring.
  ourStar: { name: 'Bizning yulduzimiz', message: 'Bu yulduz biz tanishgan kechada ham shu yerda porlab turgan edi.' },
  // Zal bo‘ylab yashirilgan xatchalar. NAMUNA MATNLAR: o‘z so‘zlaringizga almashtiring.
  reasons: [
    'Kulganingda butun xona yorishib ketadi.',
    'Yomon kunimda ham sen bilan gaplashsam yengil bo‘ladi.',
    'Har bir kichik narsani eslab yurishing.',
    'Meni o‘zim bo‘lganimcha qabul qilganing.',
    'Sen bilan jim o‘tirish ham baxt.',
    'Ko‘zlaring bir qarashda hamma gapni aytadi.',
    'Qiyin paytda yonimda turganing.',
    'Sening ovozing eng tinchlantiruvchi musiqa.',
    'Hatto arazlaganingda ham yoqimlisan.',
    'Kelajagimni sensiz tasavvur qila olmayman.',
    'Sen meni yaxshiroq odam qilasan.',
    'Chunki sen — sensan.',
  ],
  sign: 'Seni sevaman', // atirgul arkasi ostidagi yozuv
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
