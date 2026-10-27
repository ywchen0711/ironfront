// The words of the campaign, chapter by chapter: each file gives the chapter's opening (intro) and, per mission
// id, the briefing before it and the debriefing after it ({ zh: [...], en: [...] }; "Name|line" is someone speaking).
import C1 from './ch01.js?v=17';
import C2 from './ch02.js?v=17';
import C3 from './ch03.js?v=17';
import C4 from './ch04.js?v=17';
import C5 from './ch05.js?v=17';
import C6 from './ch06.js?v=17';
import C7 from './ch07.js?v=17';
import C8 from './ch08.js?v=17';
import C9 from './ch09.js?v=17';
import C10 from './ch10.js?v=17';

export const STORY = { intro: {}, m: {} };
[C1, C2, C3, C4, C5, C6, C7, C8, C9, C10].forEach((c, i) => { STORY.intro[i] = c.intro; Object.assign(STORY.m, c.m); });
