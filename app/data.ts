export const halls = ["101 AP", "107 CP", "201 LSI", "206 Sensor", "208 직속"] as const;
export type Hall = (typeof halls)[number];
export type Session={id:number;day:number;start:string;end:string;hall:Hall;type:string;title:string;description:string;speaker:string;role:string;color:string};
export const hallLocations: Record<Hall, string> = {
  '101 AP': 'The UniverSE 1층 · 101호 (AP)',
  '107 CP': 'The UniverSE 1층 · 107호 (CP)',
  '201 LSI': 'The UniverSE 2층 · 201호 (LSI)',
  '206 Sensor': 'The UniverSE 2층 · 206호 (Sensor)',
  '208 직속': 'The UniverSE 2층 · 208호 (직속)',
};
export const sessions:Session[] = [
  {
    "id": 10101,
    "day": 15,
    "start": "10:00",
    "end": "10:40",
    "hall": "101 AP",
    "type": "강연",
    "title": "협상의 기술",
    "description": "",
    "speaker": "엄준기 PL",
    "role": "Custom SOC개발팀",
    "color": "blue"
  },
  {
    "id": 10102,
    "day": 15,
    "start": "11:00",
    "end": "11:40",
    "hall": "101 AP",
    "type": "강연",
    "title": "함께 만드는 최상의 화질",
    "description": "",
    "speaker": "김동훈 TL",
    "role": "SOC IP개발팀",
    "color": "blue"
  },
  {
    "id": 10103,
    "day": 15,
    "start": "13:30",
    "end": "14:10",
    "hall": "101 AP",
    "type": "강연",
    "title": "Xclipse의 여정과 모바일 GPU 생태계",
    "description": "",
    "speaker": "한동희 PL",
    "role": "AP S/W개발팀",
    "color": "blue"
  },
  {
    "id": 10104,
    "day": 15,
    "start": "14:30",
    "end": "15:10",
    "hall": "101 AP",
    "type": "강연",
    "title": "Ulysses CPU",
    "description": "",
    "speaker": "권태현 TL",
    "role": "SOC Platform개발팀",
    "color": "blue"
  },
  {
    "id": 10105,
    "day": 15,
    "start": "15:30",
    "end": "16:10",
    "hall": "101 AP",
    "type": "강연",
    "title": "익숙함이라는 한계를 넘어",
    "description": "",
    "speaker": "김병직 PL",
    "role": "AP설계팀",
    "color": "blue"
  },
  {
    "id": 10701,
    "day": 15,
    "start": "10:00",
    "end": "10:40",
    "hall": "107 CP",
    "type": "강연",
    "title": "Exynos, 원팀으로 공정을 넘어 정상을 위한 도전",
    "description": "",
    "speaker": "송재근 PL",
    "role": "SOC전략팀",
    "color": "blue"
  },
  {
    "id": 10702,
    "day": 15,
    "start": "11:00",
    "end": "11:40",
    "hall": "107 CP",
    "type": "강연",
    "title": "AI시대, 어떻게 협업할 것인가",
    "description": "",
    "speaker": "이두정 TL",
    "role": "Connectivity개발팀",
    "color": "blue"
  },
  {
    "id": 10703,
    "day": 15,
    "start": "13:30",
    "end": "14:10",
    "hall": "107 CP",
    "type": "강연",
    "title": "UWB로 보는 Wireless 기술의 미래",
    "description": "",
    "speaker": "석현기 TL",
    "role": "RF개발팀",
    "color": "blue"
  },
  {
    "id": 10704,
    "day": 15,
    "start": "14:30",
    "end": "15:10",
    "hall": "107 CP",
    "type": "강연",
    "title": "FWA도 되는 TCU",
    "description": "",
    "speaker": "최진원 님",
    "role": "Moden개발팀",
    "color": "blue"
  },
  {
    "id": 10705,
    "day": 15,
    "start": "15:30",
    "end": "16:10",
    "hall": "107 CP",
    "type": "강연",
    "title": "코드는 AI가 개발자는?",
    "description": "",
    "speaker": "심현석 님",
    "role": "CP S/W개발팀",
    "color": "blue"
  },
  {
    "id": 20101,
    "day": 15,
    "start": "10:00",
    "end": "10:40",
    "hall": "201 LSI",
    "type": "강연",
    "title": "덜 알고 맞는것은 모르고 맞는것과 큰 차이가 없습니다",
    "description": "",
    "speaker": "김학송 님",
    "role": "Mobile DDI개발팀",
    "color": "blue"
  },
  {
    "id": 20102,
    "day": 15,
    "start": "11:00",
    "end": "11:40",
    "hall": "201 LSI",
    "type": "강연",
    "title": "개발에서 논문까지 Display개발자의 기록",
    "description": "",
    "speaker": "변산호 님",
    "role": "Mobile DDI개발팀",
    "color": "blue"
  },
  {
    "id": 20103,
    "day": 15,
    "start": "13:30",
    "end": "14:10",
    "hall": "201 LSI",
    "type": "강연",
    "title": "AI가 확장하는 AR Class의 가능성",
    "description": "",
    "speaker": "류성영 님",
    "role": "LSI선행개발팀",
    "color": "blue"
  },
  {
    "id": 20104,
    "day": 15,
    "start": "14:30",
    "end": "15:10",
    "hall": "201 LSI",
    "type": "강연",
    "title": "3세대 SoC PMIC 개발기",
    "description": "",
    "speaker": "문영진 님",
    "role": "Security & Power제품개발팀",
    "color": "blue"
  },
  {
    "id": 20105,
    "day": 15,
    "start": "15:30",
    "end": "16:10",
    "hall": "201 LSI",
    "type": "강연",
    "title": "기술로 지킨 자리",
    "description": "",
    "speaker": "김용훈 TL",
    "role": "Panel DDI개발팀",
    "color": "blue"
  },
  {
    "id": 20601,
    "day": 15,
    "start": "10:00",
    "end": "10:40",
    "hall": "206 Sensor",
    "type": "강연",
    "title": "CIS 세계 최소 노이즈를 향한 여정",
    "description": "",
    "speaker": "최성수 PL",
    "role": "Pixel개발팀",
    "color": "blue"
  },
  {
    "id": 20602,
    "day": 15,
    "start": "11:00",
    "end": "11:40",
    "hall": "206 Sensor",
    "type": "강연",
    "title": "센서 사업의 새로운 도전",
    "description": "",
    "speaker": "조승한 PL",
    "role": "Sensor Solution팀",
    "color": "blue"
  },
  {
    "id": 20603,
    "day": 15,
    "start": "13:30",
    "end": "14:10",
    "hall": "206 Sensor",
    "type": "강연",
    "title": "독일의 시스템과 유럽의 다양성",
    "description": "",
    "speaker": "이상규 파트장",
    "role": "Sensor전략팀",
    "color": "blue"
  },
  {
    "id": 20604,
    "day": 15,
    "start": "14:30",
    "end": "15:10",
    "hall": "206 Sensor",
    "type": "강연",
    "title": "특허로 기술 읽기",
    "description": "",
    "speaker": "진영구 님",
    "role": "Pixel개발팀",
    "color": "blue"
  },
  {
    "id": 20605,
    "day": 15,
    "start": "15:30",
    "end": "16:10",
    "hall": "206 Sensor",
    "type": "강연",
    "title": "Physical AI 시대의 이미지 센서",
    "description": "",
    "speaker": "길민선 PL",
    "role": "Sensor설계팀",
    "color": "blue"
  },
  {
    "id": 20801,
    "day": 15,
    "start": "10:00",
    "end": "10:40",
    "hall": "208 직속",
    "type": "강연",
    "title": "AI가 바꾼 PDK 품질관리",
    "description": "",
    "speaker": "이진상 TL",
    "role": "DTCO팀",
    "color": "blue"
  },
  {
    "id": 20802,
    "day": 15,
    "start": "11:00",
    "end": "11:40",
    "hall": "208 직속",
    "type": "강연",
    "title": "공격자의 시선으로 설계하기",
    "description": "",
    "speaker": "남현석 님",
    "role": "IP개발팀",
    "color": "blue"
  },
  {
    "id": 20803,
    "day": 15,
    "start": "13:30",
    "end": "14:10",
    "hall": "208 직속",
    "type": "강연",
    "title": "AI Agent로 좁힌 검증의 Gap",
    "description": "",
    "speaker": "이종필 그룹장",
    "role": "품질팀",
    "color": "blue"
  },
  {
    "id": 20804,
    "day": 15,
    "start": "14:30",
    "end": "15:10",
    "hall": "208 직속",
    "type": "강연",
    "title": "역사를 사랑한 소년, AI엔지니어가 되기까지",
    "description": "",
    "speaker": "이태교 님",
    "role": "S/W혁신팀",
    "color": "blue"
  },
  {
    "id": 20805,
    "day": 15,
    "start": "15:30",
    "end": "16:10",
    "hall": "208 직속",
    "type": "강연",
    "title": "SEVA의 여정",
    "description": "",
    "speaker": "고재혁 PL",
    "role": "Design Technology팀",
    "color": "blue"
  }
];
export const events=[{id:'connect',label:'NETWORKING',title:'Hello, developers.',text:'같은 호기심을 가진 사람들과\n새로운 연결을 시작하세요.',time:'10.15 · 18:00–19:30',place:'Community Lounge'}, {id:'build',label:'EXPERIENCE',title:'Build. Play. Discover.',text:'직접 만지고 경험하는 기술.\n새로운 가능성을 발견해보세요.',time:'10.15 · 10:00–17:00',place:'Experience Zone'}, {id:'code',label:'CHALLENGE',title:'Your next big idea.',text:'작은 아이디어를 코드로.\n개발자 챌린지에 도전하세요.',time:'10.15 · 14:00–17:00',place:'201 LSI'}];
export function filterSessions(hall:string,query:string){
 return sessions.filter(s=>s.hall===hall&&`${s.title} ${s.type} ${s.speaker}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>a.start.localeCompare(b.start));
}

export function nextSavedSession(savedIds: readonly number[], now: number): Session | undefined {
  const startTime = (session: Session) => Date.parse(`2026-10-${String(session.day).padStart(2, '0')}T${session.start}:00+09:00`);
  return sessions
    .filter(session => savedIds.includes(session.id) && startTime(session) >= now)
    .sort((a, b) => startTime(a) - startTime(b) || a.hall.localeCompare(b.hall) || a.id - b.id)[0];
}
