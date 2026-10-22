# ORIGIN — Game Design Notes

## Core fantasy
ผู้เล่นเป็นผู้ดูแลเส้นทางวิวัฒนาการ ไม่ได้ควบคุมสิ่งมีชีวิตทีละตัวโดยตรง แต่เลือกลงทุนในแรงขับที่ทำให้ชีวิตและอารยธรรมเติบโตเอง

## Core loop
1. สะสมทรัพยากรอัตโนมัติ
2. ลงทุนในสิ่งมีชีวิต/นวัตกรรมเพื่อเพิ่มอัตราการผลิต
3. วิจัยเทคโนโลยีและเปิดเผยสิ่งมีชีวิต
4. สะสม DNA เพื่อข้ามยุค
5. เริ่มวัฏจักรใหม่เพื่อโบนัสระยะยาว

## Resource roles
- DNA: ใช้ปลดล็อกยุคและกลายพันธุ์
- พลังงาน: ใช้พัฒนาชีววิทยาและโครงสร้างพื้นฐาน
- ประชากร: ตัวแทนขนาดของระบบชีวิตและอารยธรรม
- ความรู้: ใช้วิจัยเทคโนโลยี

## v0.3 simulation model (สรุป)
- 30 tick = 1 วินาทีจำลอง; สิ่งมีชีวิตตัดสินใจทุก 5 tick (สลับกัน) ด้วย spatial grid
- พลังงานเข้า = การกินพืช × ประสิทธิภาพการย่อย (ความซับซ้อน ขนาด เครื่องมือ) หรือการล่า; พลังงานออก = เมแทบอลิซึมตามขนาด/ความเร็ว/สมอง + การเคลื่อนที่ + ความไม่เหมาะกับอุณหภูมิ/ถิ่นอาศัย + ความแออัด
- สายพันธุ์ใหม่เมื่อระยะห่างทางพันธุกรรมจากศูนย์กลางสายพันธุ์ > 0.085
- ยุคใหม่ = ยกขีดจำกัดยีน + "นวัตกรรมทางวิวัฒนาการ" ในประชากรกลุ่มเล็ก (ผู้ล่าแรก, หลายเซลล์, ขึ้นบก, ใช้เครื่องมือ) ที่ยังต้องรอดเอง

## Planet view (v0.7)
- โลกจำลองยังเป็นแผนที่แบน 1920×1080 เหมือนเดิม มุมมองดาวแค่ "ห่อ" แผนที่รอบทรงกลม: ลองจิจูด = x/W·2π, ละติจูด = (0.5 − y/H)·0.86π รัศมีดาว = W/2π เพื่อให้ระยะตามแนวเส้นศูนย์สูตรเท่ากับระยะในโลกจำลอง
- ทุกวัตถุถูกวางด้วยเฟรมท้องถิ่น (ตะวันออก, ขึ้น, ใต้) ที่จุดนั้น จึงใช้โมเดลและโค้ดวางวัตถุชุดเดียวกับมุมมอง 3D แบน
- ขอบแผนที่เป็นทะเลอยู่แล้ว รอยต่อที่ลองจิจูด 0 จึงจมใต้มหาสมุทร ส่วนขั้วโลกปิดด้วยแผ่นน้ำแข็ง
- ดวงอาทิตย์อยู่เหนือเส้นเมริเดียนกลางแผนที่ตอนเที่ยงตามนาฬิกาในเกม

## Biodiversity (v0.8)
- 63 body plans are classified from genes plus the preferred temperature gene (`thermal`), e.g. a hot-adapted grazer is a camel, a cold-adapted giant herbivore is a mammoth.
- Niche partitioning: every body plan has home biomes (`HOME` in archetypes.js). Grazing there is ×1.6, elsewhere ×0.65, and foraging prefers home biomes.
- Kill-the-winner: a body plan above 20% of all animals loses breeding attempts in proportion to its excess share (`CROWD` in sim.js).
- Empty niches are re-filled every 15 sim seconds (`NICHE_EVERY`); climate-bound niches (camel, mammoth, penguin, reef fish, scorpion) only appear where the local temperature fits.

## Long-term roadmap
- v0.3: สายวิวัฒนาการแบบ branching, trait selection และเหตุการณ์สุ่มที่มีผลต่อระบบนิเวศ
- v0.4: ภาพสิ่งมีชีวิต procedural, biomes และแผนที่โลกที่ตอบสนองต่อการเปลี่ยนยุค
- v0.5: เมืองและอาณานิคมดาวเคราะห์ที่มีอาคารและสายการผลิตแยกกัน
- v0.6: ภารกิจสำรวจ, resource sinks, achievement milestones และบาลานซ์ progression
- v0.7: ทดสอบอัตโนมัติ, accessibility, localization และ performance profiling
- v1.0: tutorial, save migration, settings เต็มรูปแบบ และ release packaging

## Design principles
- Idle ต้องให้ความรู้สึกก้าวหน้าโดยไม่ต้องคลิกตลอดเวลา
- การปลดล็อกแต่ละยุคควรเปิดของเล่นใหม่ ไม่ใช่แค่ตัวเลขใหญ่ขึ้น
- การตัดสินใจควรมี trade-off ระหว่างการผลิต ความหลากหลาย และเสถียรภาพของโลก
- ข้อมูลเซฟควร export/import ได้ และเกมพื้นฐานควรเล่น offline ได้
