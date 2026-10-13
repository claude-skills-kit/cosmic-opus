// Cosmic Calendar — Thai narration (ElevenLabs Eleven v4, voice "Jessica") and sound effects
// (ElevenLabs Sound Effects v2), both generated through fal.ai. Lengths are the cut clips in seconds.
export const VO_LEAD = 0.7, VO_TAIL = 1.1;
export const VO = {bigbang:8.74,cmb:12.05,stars:8.4,supernova:12.67,galaxy:8.66,blackhole:9.78,sunbirth:9.39,disk:7.84,solar:5.46,
  theia:9.46,bombardment:9.06,firstlife:7.45,oxygen:9.65,snowball:8.28,cambrian:8.14,dinosaurs:11.97,humans:6.55,civilization:8.56,
  spaceage:8.05,moon:7.28,paleblue:12.28};
const ORDER = Object.keys(VO);
export const voFile = id => `audio/vo/cosmic/${String(ORDER.indexOf(id) + 1).padStart(2, '0')}-${id}.mp3`;

// [at, file, gain, peak] — `at` is in the scene's ORIGINAL timing (the same clock as its `fx`), so a
// cue still lands on its visual beat after the scene is slowed to fit the voice; `peak` is how far
// into the file the hit sits, and the cue starts that much early.
export const SFX = {
  bigbang:[[1.3,'cc-bigbang',1,0]], cmb:[[0.3,'cc-cmb',0.7,0]], stars:[[0.5,'cc-stars',0.8,0]],
  supernova:[[3.6,'cc-supernova',1,0.45]], galaxy:[[0.3,'cc-galaxy',0.75,0]], blackhole:[[0.3,'cc-blackhole',0.85,0]],
  sunbirth:[[5.8,'cc-sunbirth',1,0.5]], disk:[[0.4,'cc-disk',0.7,0]], solar:[[0.3,'cc-solar',0.6,0]],
  theia:[[4.3,'cc-theia',1,0.05]], bombardment:[[0.3,'cc-bombard',0.8,0]], firstlife:[[0.3,'cc-firstlife',0.7,0]],
  oxygen:[[0.3,'cc-oxygen',0.65,0]], snowball:[[0.3,'cc-snowball',0.7,0]], cambrian:[[0.3,'cc-cambrian',0.65,0]],
  dinosaurs:[[0.6,'cc-dino',0.8,0],[5.2,'cc-asteroid',1,1.25]], humans:[[0.3,'cc-humans',0.7,0]],
  civilization:[[0.3,'cc-city',0.6,0]], spaceage:[[0.6,'cc-sputnik',0.8,0]], moon:[[0.3,'cc-moon',0.7,0]],
  paleblue:[[0.5,'cc-paleblue',0.75,0]]
};
export const sfxFile = n => `audio/sfx/${n}.mp3`;
