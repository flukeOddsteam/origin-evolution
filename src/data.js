export const ERAS = [
 {id:"origin",name:"มหาสมุทรแห่งจุดกำเนิด",type:"ORIGIN OF LIFE",description:"ก่อนจะมีโลกที่เรารู้จัก มีเพียงสารเคมี พลังงาน และโอกาสเล็ก ๆ ที่ชีวิตจะถือกำเนิดขึ้น",need:100,unlock:"กำเนิดเซลล์แรก",icon:"🌊"},
 {id:"cells",name:"ยุคเซลล์แรก",type:"MICROBIAL AGE",description:"สิ่งมีชีวิตเซลล์เดียวเริ่มแบ่งตัว ปรับตัว และเปลี่ยนมหาสมุทรให้กลายเป็นแหล่งกำเนิดความหลากหลาย",need:650,unlock:"ชีวิตหลายเซลล์",icon:"🦠"},
 {id:"multicellular",name:"ชีวิตหลายเซลล์",type:"MULTICELLULAR ERA",description:"เซลล์เรียนรู้การทำงานร่วมกัน เกิดโครงสร้างที่ซับซ้อนและความสามารถใหม่ ๆ",need:3500,unlock:"การพิชิตผืนดิน",icon:"🧫"},
 {id:"land",name:"การพิชิตผืนดิน",type:"LAND COLONIZATION",description:"สิ่งมีชีวิตขึ้นจากทะเล พัฒนาปอด ขา และประสาทสัมผัสเพื่อสำรวจโลกใหม่",need:18000,unlock:"มนุษย์ยุคแรก",icon:"🦎"},
 {id:"tribes",name:"รุ่งอรุณแห่งมนุษย์",type:"EARLY HUMANS",description:"มนุษย์เริ่มใช้เครื่องมือ สื่อสาร และรวมกลุ่มเพื่อเพิ่มโอกาสรอดชีวิต",need:90000,unlock:"เกษตรกรรม",icon:"🪨"},
 {id:"agriculture",name:"ยุคเกษตรกรรม",type:"AGRICULTURAL AGE",description:"การเพาะปลูกทำให้เกิดชุมชนถาวร อาหารส่วนเกิน และประชากรที่เพิ่มขึ้น",need:450000,unlock:"นครแห่งแรก",icon:"🌾"},
 {id:"cities",name:"นครและอารยธรรม",type:"AGE OF CIVILIZATION",description:"เมือง การค้า ภาษาเขียน และความรู้ที่ส่งต่อกันเปลี่ยนชุมชนเป็นอารยธรรม",need:2200000,unlock:"เครื่องจักรไอน้ำ",icon:"🏛️"},
 {id:"industry",name:"ยุคอุตสาหกรรม",type:"INDUSTRIAL REVOLUTION",description:"เครื่องจักรและพลังงานรูปแบบใหม่เพิ่มผลผลิตอย่างมหาศาล พร้อมสร้างความท้าทายต่อโลก",need:12000000,unlock:"เครือข่ายดิจิทัล",icon:"⚙️"},
 {id:"digital",name:"ยุคดิจิทัลและ AI",type:"DIGITAL INTELLIGENCE",description:"ข้อมูล เครือข่าย และปัญญาประดิษฐ์เปลี่ยนวิธีที่อารยธรรมเรียนรู้และสร้างสิ่งใหม่",need:75000000,unlock:"อาณานิคมดาวเคราะห์",icon:"🤖"},
 {id:"space",name:"อารยธรรมอวกาศ",type:"SPACEFARING CIVILIZATION",description:"สิ่งมีชีวิตออกจากโลก ตั้งอาณานิคม และใช้ทรัพยากรจากดาวเคราะห์อื่น",need:500000000,unlock:"อารยธรรมระหว่างดาว",icon:"🚀"},
 {id:"interstellar",name:"อารยธรรมระหว่างดาว",type:"INTERSTELLAR AGE",description:"อารยธรรมขยายข้ามระบบดาว เทคโนโลยีและชีววิทยาเริ่มหลอมรวมเป็นรูปแบบใหม่",need:4000000000,unlock:"จุดเอกฐาน",icon:"🌌"},
 {id:"singularity",name:"จุดเอกฐานแห่งวิวัฒนาการ",type:"EVOLUTIONARY SINGULARITY",description:"ชีวิต ความรู้ และพลังงานก้าวข้ามขอบเขตเดิม จักรวาลกลายเป็นบ้านหลังใหม่",need:Infinity,unlock:"วิวัฒนาการสูงสุด",icon:"✧"}
];

export const RESOURCES = [
 {id:"dna",name:"DNA",label:"สารพันธุกรรม",icon:"🧬",color:"mint"},
 {id:"energy",name:"พลังงาน",label:"พลังงานสะสม",icon:"⚡",color:"gold"},
 {id:"population",name:"ประชากร",label:"สิ่งมีชีวิตทั้งหมด",icon:"👥",color:"blue"},
 {id:"knowledge",name:"ความรู้",label:"ความรู้สะสม",icon:"🔬",color:"purple"}
];

export const UPGRADES = [
 {id:"primordialSoup",name:"สารตั้งต้นแห่งชีวิต",icon:"🫧",desc:"สารอินทรีย์รวมตัวเป็นโครงสร้างพื้นฐานของชีวิต",era:0,cost:12,res:"energy",effects:{dna:0.25},lore:"เคมีที่ซับซ้อนอาจเป็นก้าวแรกสู่ชีววิทยา"},
 {id:"microbes",name:"จุลชีพ",icon:"🦠",desc:"ประชากรจุลชีพสร้าง DNA อย่างต่อเนื่อง",era:0,cost:18,res:"energy",effects:{dna:0.55,population:0.08},lore:"ผู้บุกเบิกที่เปลี่ยนโลกทั้งใบ"},
 {id:"sunlight",name:"สังเคราะห์แสง",icon:"☀️",desc:"เก็บเกี่ยวพลังงานจากแสงดาว",era:0,cost:40,res:"dna",effects:{energy:1.1},lore:"ออกซิเจนจะเปลี่ยนชะตาของดาวเคราะห์"},
 {id:"membranes",name:"เยื่อหุ้มเซลล์",icon:"🧫",desc:"เพิ่มความทนทานและประสิทธิภาพของเซลล์",era:1,cost:110,res:"dna",effects:{dna:1.5,population:0.2},lore:"ขอบเขตระหว่างสิ่งมีชีวิตกับโลกภายนอก"},
 {id:"cooperation",name:"การทำงานร่วมกัน",icon:"🧬",desc:"เซลล์แบ่งหน้าที่เพื่อสร้างสิ่งมีชีวิตซับซ้อน",era:2,cost:420,res:"energy",effects:{population:0.8,dna:2.2},lore:"ความร่วมมือเปิดทางให้ความซับซ้อน"},
 {id:"limbs",name:"แขนขาและการเคลื่อนที่",icon:"🦎",desc:"เคลื่อนที่ได้ดีขึ้นและสำรวจถิ่นอาศัยใหม่",era:3,cost:1500,res:"dna",effects:{dna:8,population:1.2},lore:"การเดินทางเปิดโอกาสใหม่แก่ชีวิต"},
 {id:"tools",name:"เครื่องมือหิน",icon:"🪨",desc:"เพิ่มประสิทธิภาพการหาอาหารและเรียนรู้",era:4,cost:5000,res:"energy",effects:{knowledge:0.8,population:2},lore:"เครื่องมือคือส่วนต่อขยายของร่างกาย"},
 {id:"language",name:"ภาษาและเรื่องเล่า",icon:"🗣️",desc:"ถ่ายทอดความรู้ระหว่างรุ่นได้รวดเร็ว",era:4,cost:8500,res:"knowledge",effects:{knowledge:1.8,dna:5},lore:"ความรู้ไม่ต้องเริ่มจากศูนย์ทุกชั่วอายุ"},
 {id:"farming",name:"เกษตรกรรม",icon:"🌾",desc:"สร้างอาหารส่วนเกินและชุมชนถาวร",era:5,cost:18000,res:"energy",effects:{population:8,energy:8},lore:"อาหารส่วนเกินช่วยให้เกิดอาชีพเฉพาะทาง"},
 {id:"writing",name:"ภาษาเขียน",icon:"📜",desc:"เก็บรักษาความรู้และระบบการปกครอง",era:6,cost:90000,res:"knowledge",effects:{knowledge:12,dna:20},lore:"ความทรงจำของอารยธรรมยาวนานกว่าชีวิตคน"},
 {id:"engines",name:"เครื่องจักรไอน้ำ",icon:"⚙️",desc:"เปลี่ยนพลังงานให้เป็นกำลังการผลิต",era:7,cost:550000,res:"energy",effects:{energy:45,knowledge:18},lore:"เครื่องจักรเร่งทั้งการผลิตและการเปลี่ยนแปลง"},
 {id:"electricity",name:"โครงข่ายไฟฟ้า",icon:"💡",desc:"ส่งพลังงานไปทั่วอารยธรรม",era:7,cost:900000,res:"knowledge",effects:{energy:100,population:18},lore:"พลังงานที่เข้าถึงได้เปลี่ยนชีวิตประจำวัน"},
 {id:"ai",name:"ปัญญาประดิษฐ์",icon:"🤖",desc:"ระบบอัตโนมัติช่วยวิจัยและจัดสรรทรัพยากร",era:8,cost:4500000,res:"knowledge",effects:{knowledge:140,dna:100},lore:"เครื่องมือที่ช่วยให้เครื่องมือฉลาดขึ้น"},
 {id:"rockets",name:"จรวดขนส่ง",icon:"🚀",desc:"เปิดทางสู่อาณานิคมนอกโลก",era:9,cost:25000000,res:"energy",effects:{population:250,knowledge:220},lore:"โลกเป็นเพียงจุดเริ่มต้น"},
 {id:"stellarArray",name:"แผงเก็บพลังงานดาวฤกษ์",icon:"🌞",desc:"เก็บเกี่ยวพลังงานจากดาวฤกษ์ในระดับมหาศาล",era:10,cost:220000000,res:"knowledge",effects:{energy:1200,dna:900,population:500},lore:"อารยธรรมเริ่มคิดในระดับระบบดาว"}
];

export const ORGANISMS = [
 {id:"replicator",name:"โมเลกุลจำลองตัวเอง",icon:"🫧",era:0,trait:"การจำลองตัวเอง",description:"ต้นแบบของระบบที่ส่งต่อข้อมูลได้",bonus:"DNA",base:0.18},
 {id:"microbe",name:"จุลชีพทนทาน",icon:"🦠",era:0,trait:"ปรับตัวเก่ง",description:"อยู่รอดในสภาพแวดล้อมที่หลากหลาย",bonus:"DNA",base:0.3},
 {id:"algae",name:"สาหร่ายสังเคราะห์แสง",icon:"🪸",era:1,trait:"ผลิตพลังงาน",description:"เปลี่ยนแสงให้เป็นพลังงานเคมี",bonus:"พลังงาน",base:0.65},
 {id:"colony",name:"สิ่งมีชีวิตหลายเซลล์",icon:"🧫",era:2,trait:"ร่วมมือ",description:"เซลล์แบ่งหน้าที่และพึ่งพากัน",bonus:"ประชากร",base:0.5},
 {id:"crawler",name:"สัตว์บกยุคแรก",icon:"🦎",era:3,trait:"เคลื่อนที่คล่องตัว",description:"สำรวจแหล่งอาหารบนผืนดิน",bonus:"DNA",base:1.3},
 {id:"mammal",name:"สัตว์เลี้ยงลูกด้วยนม",icon:"🐾",era:3,trait:"ดูแลลูกอ่อน",description:"การเรียนรู้และการดูแลเพิ่มโอกาสรอด",bonus:"ประชากร",base:1.2},
 {id:"human",name:"มนุษย์ผู้ใช้เครื่องมือ",icon:"🧑",era:4,trait:"เรียนรู้ทางสังคม",description:"ส่งต่อทักษะผ่านการเลียนแบบและภาษา",bonus:"ความรู้",base:1.4},
 {id:"crop",name:"พืชเพาะปลูก",icon:"🌱",era:5,trait:"ผลผลิตสูง",description:"แหล่งอาหารที่ดูแลและขยายพื้นที่ได้",bonus:"พลังงาน",base:3},
 {id:"synthetic",name:"สิ่งมีชีวิตสังเคราะห์",icon:"🧬",era:8,trait:"ออกแบบพันธุกรรม",description:"ชีววิทยาที่ถูกออกแบบเพื่อภารกิจเฉพาะ",bonus:"DNA",base:8},
 {id:"cosmic",name:"สิ่งมีชีวิตดัดแปลงอวกาศ",icon:"👾",era:9,trait:"ทนสภาพสุดขั้ว",description:"รูปแบบชีวิตที่เหมาะกับถิ่นอาศัยนอกโลก",bonus:"ประชากร",base:15}
];

export const TECHS = [
 {id:"genome",name:"การอ่านจีโนม",icon:"🧬",era:1,cost:120,desc:"เพิ่มผลผลิต DNA จากสิ่งมีชีวิตทั้งหมด",bonus:"DNA +20%",effect:{dna:0.2}},
 {id:"ecology",name:"นิเวศวิทยา",icon:"🌿",era:2,cost:550,desc:"เพิ่มความสมดุลและการเติบโตของประชากร",bonus:"ประชากร +20%",effect:{population:0.2}},
 {id:"cognition",name:"ประสาทรับรู้",icon:"🧠",era:3,cost:2200,desc:"สิ่งมีชีวิตเรียนรู้จากสิ่งแวดล้อมได้เร็วขึ้น",bonus:"ความรู้ +25%",effect:{knowledge:0.25}},
 {id:"agronomy",name:"วิทยาศาสตร์การเกษตร",icon:"🌾",era:5,cost:25000,desc:"เพิ่มผลผลิตพลังงานจากระบบอาหาร",bonus:"พลังงาน +30%",effect:{energy:0.3}},
 {id:"scientificMethod",name:"วิธีการทางวิทยาศาสตร์",icon:"🔭",era:6,cost:180000,desc:"เร่งการวิจัยเทคโนโลยี",bonus:"ความรู้ +35%",effect:{knowledge:0.35}},
 {id:"automation",name:"ระบบอัตโนมัติ",icon:"⚙️",era:7,cost:1100000,desc:"ปรับปรุงผลผลิตทุกประเภท",bonus:"ผลผลิตทั้งหมด +15%",effect:{all:0.15}},
 {id:"machineLearning",name:"การเรียนรู้ของเครื่อง",icon:"🤖",era:8,cost:9000000,desc:"AI ช่วยคัดเลือกเส้นทางพัฒนาที่มีประสิทธิภาพ",bonus:"ผลผลิตทั้งหมด +25%",effect:{all:0.25}},
 {id:"terraforming",name:"การปรับสภาพดาว",icon:"🪐",era:9,cost:85000000,desc:"ขยายถิ่นอาศัยที่เหมาะสมต่อชีวิต",bonus:"ประชากร +50%",effect:{population:0.5}},
 {id:"stellarPhysics",name:"ฟิสิกส์ระหว่างดาว",icon:"🌌",era:10,cost:650000000,desc:"ใช้ความรู้ระดับดาวฤกษ์เพิ่มผลผลิตโดยรวม",bonus:"ผลผลิตทั้งหมด +50%",effect:{all:0.5}}
];
