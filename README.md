# จักรวาลสองบาน · Cosmic Opus

สองโปรเจกต์อวกาศ 3D ที่เปิดเล่นได้ในเบราว์เซอร์ เขียนด้วย **Claude Opus 5.5** แจกฟรีให้เอาไปศึกษา ดัดแปลง หรือใช้สอนได้เลย

**ลองเล่น:** https://cosmic-opus.pages.dev

![จักรวาลสองบาน](og.jpg)

| | |
|---|---|
| ![Cosmic Calendar](img/cc-blackhole.webp) | ![Solar System Explorer](img/ss-saturn.webp) |
| **ปฏิทินจักรวาล** · `cosmic.html` | **ระบบสุริยะ** · `solar.html` |

## ในนี้มีอะไร

**ปฏิทินจักรวาล (The Cosmic Calendar 3D)**
ย่อ 13,800 ล้านปีให้เหลือหนึ่งปีปฏิทิน เล่าเป็นภาพยนตร์ 21 ฉาก ยาวราว 3 นาทีครึ่ง ตั้งแต่บิกแบง หลุมดำ Sagittarius A* (ray-marched ใน shader) ดวงจันทร์ถือกำเนิด ไปจนถึง Pale Blue Dot มีคำบรรยายไทย/อังกฤษ และดนตรีที่สังเคราะห์สดด้วย Web Audio (ไม่มีไฟล์เสียงสักไฟล์)

- `cc19-core.js` renderer, post-processing, shader ของดวงอาทิตย์ โลก ดาวเคราะห์
- `cc19-cosmos.js` ฉากระดับจักรวาล (บิกแบง → ระบบสุริยะ)
- `cc19-earth.js` ฉากของโลกและมนุษย์ (ดวงจันทร์ → จุดสีฟ้าจาง ๆ)
- `cc19-app.js` ไทม์ไลน์ คำบรรยาย แถบปฏิทิน การควบคุม
- `cosmic-audio.js` เครื่องดนตรี generative

คีย์ลัด: `Space` เล่น/หยุด · `[` `]` เปลี่ยนบท · `L` ภาษา · `M` เสียง · `H` ซ่อน UI · `F` เต็มจอ

**ระบบสุริยะ (Solar System Explorer)**
ห้องเรียนอวกาศแบบโต้ตอบ ตำแหน่งดาวคำนวณจากวันที่จริงด้วยองค์ประกอบวงโคจร J2000 ของ JPL มีทัวร์นำชม บทเรียนรายดาว (โครงสร้าง บรรยากาศ บริวาร ภารกิจ) เครื่องมือเทียบขนาด คำนวณน้ำหนัก/อายุบนดาวอื่น เวลาเดินทาง แสงเดินทาง ไทม์ไลน์ และแบบทดสอบ

- `solar-data.js` ข้อมูลดาว + ฟิสิกส์วงโคจร (Kepler)
- `solar-3d.js` ฉาก three.js, shader ดาว, แถบดาวเคราะห์น้อย/ไคเปอร์
- `solar-tools-v2.js` เครื่องมือประกอบการสอน
- `solar-app-v2.js` UI, ทัวร์, คีย์ลัด

คีย์ลัด: `1–8` ดาวเคราะห์ · `9` ดวงจันทร์ · `0` ดวงอาทิตย์ · `T` ทัวร์ · `L` แสงเดินทาง · `O` ภาพรวม · `?` คู่มือ

## รันเอง

ไม่มี build ไม่ต้อง `npm install` เป็นไฟล์ static ล้วน แต่ต้องเปิดผ่าน web server (เปิดไฟล์ตรง ๆ แบบ `file://` แล้ว ES modules กับ texture จะโหลดไม่ขึ้น)

```bash
git clone https://github.com/claude-skills-kit/cosmic-opus.git
cd cosmic-opus
python3 -m http.server 8000
# เปิด http://localhost:8000
```

three.js r160 โหลดจาก unpkg ผ่าน import map ต้องต่อเน็ตตอนเปิด

**ขึ้นเว็บ:** อัปทั้งโฟลเดอร์ขึ้นโฮสต์ static ไหนก็ได้ เช่น Cloudflare Pages (`npx wrangler pages deploy . --project-name <ชื่อ>`), GitHub Pages, Netlify, Vercel

## ต้องใช้อะไร

เบราว์เซอร์ที่รองรับ WebGL2 (Chrome, Edge, Safari, Firefox รุ่นใหม่) ฉากหลุมดำหนักพอสมควร บนมือถือรุ่นเก่าอาจกระตุก

## สัญญาอนุญาต

- **โค้ด** (HTML/CSS/JS): MIT — ดู [LICENSE](LICENSE)
- **ภาพพื้นผิวดาว** ใน `textures/`: ไม่อยู่ใต้ MIT เป็นของ Solar System Scope (CC BY 4.0, อ้างอิงข้อมูล NASA) และ three.js (MIT) — ดู [textures/CREDITS.md](textures/CREDITS.md) ถ้าเอาไปใช้ต่อ ให้คงเครดิตไว้

---

### English

Two browser-based 3D space pieces, written with **Claude Opus 5.5** and given away free.

- **The Cosmic Calendar 3D** (`cosmic.html`): 13.8 billion years squeezed into one calendar year. A 21-scene, ~3.5-minute film from the Big Bang to the Pale Blue Dot, with Thai/English captions and a generative Web Audio score.
- **Solar System Explorer** (`solar.html`): an interactive classroom. Planet positions for any date come from JPL J2000 orbital elements. Includes a guided tour, per-planet lessons, size comparisons, weight, age and travel-time calculators, a light-travel visualisation, a timeline and quizzes.

It's plain static files with no build step. Serve the folder (`python3 -m http.server`) and open it in a browser; `file://` won't load the modules. Code is MIT. Textures are CC BY 4.0 (Solar System Scope) or MIT (three.js), and their credits must travel with them.

Made by [Quiet Kit Co.](https://github.com/claude-skills-kit)
