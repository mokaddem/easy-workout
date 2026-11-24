import type { Exercise } from '../domain';

type Pair = { fr: string; en: string };
type Steps = { fr: string[]; en: string[] };
type Spec = Pick<
  Exercise,
  'id' | 'primaryMuscles' | 'secondaryMuscles' | 'equipment' | 'unilateral' | 'position' | 'joints'
> &
  Partial<Pick<Exercise, 'difficulty' | 'easier' | 'harder' | 'loadType'>> & {
    name: Pair;
    execution: Steps;
    keyCue: Pair;
  };

/** Static holds: unloaded, timed, never graded high on a joint. */
const hold = (spec: Spec): Exercise => ({
  difficulty: 1,
  easier: [],
  harder: [],
  loadType: 'bodyweight',
  ...spec,
  pattern: 'mobility',
  tags: ['mobility', 'stretch'],
  metric: 'time',
});

export const stretchUpperExercises: readonly Exercise[] = [
  // Chest
  hold({
    id: 'clasped-hands-chest-opener',
    name: { fr: 'Ouverture de poitrine mains jointes', en: 'Clasped-hands chest opener' },
    execution: {
      fr: [
        'Debout, grand, joins les mains derrière le dos.',
        'Tends les bras et éloigne doucement les mains du dos.',
        'Ouvre la poitrine sans cambrer le bas du dos.',
        'Respire lentement en tenant la position.',
      ],
      en: [
        'Stand tall and clasp your hands behind your back.',
        'Straighten your arms and gently move your hands away from your back.',
        'Open your chest without arching your lower back.',
        'Breathe slowly while holding the position.',
      ],
    },
    keyCue: {
      fr: 'Va jusqu’à une tension légère, jamais jusqu’à la douleur.',
      en: 'Go to a mild stretch, never to pain.',
    },
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front-delts', 'biceps'],
    equipment: [[]],
    unilateral: false,
    position: 'standing',
    harder: ['wall-pec-stretch'],
    joints: {},
  }),
  hold({
    id: 'wall-pec-stretch',
    name: { fr: 'Étirement des pectoraux au mur', en: 'Wall pec stretch' },
    execution: {
      fr: [
        'Place l’avant-bras ou la main contre un mur ou un encadrement de porte, coude à hauteur d’épaule.',
        'Tourne doucement le buste à l’opposé du bras jusqu’à sentir un étirement devant l’épaule.',
        'Garde l’épaule basse.',
        'Respire calmement ; sans rebond, tension légère, jamais de douleur. Change de côté.',
      ],
      en: [
        'Place your forearm or hand against a wall or door frame, elbow at shoulder height.',
        'Slowly turn your chest away from that arm until you feel a stretch across the front of the shoulder.',
        'Keep your shoulder down.',
        'Breathe slowly; no bouncing, mild tension, never pain. Switch sides.',
      ],
    },
    keyCue: {
      fr: 'Tourne lentement, sans à-coups, jusqu’à une tension légère.',
      en: 'Turn slowly with no bouncing, to a mild stretch.',
    },
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front-delts', 'biceps'],
    equipment: [[{ kind: 'wall' }], [{ kind: 'door' }]],
    unilateral: true,
    position: 'standing',
    easier: ['clasped-hands-chest-opener'],
    harder: ['doorway-pec-stretch'],
    joints: {},
  }),
  hold({
    id: 'doorway-pec-stretch',
    name: { fr: 'Étirement des pectoraux dans l’encadrement de porte', en: 'Doorway pec stretch' },
    difficulty: 2,
    execution: {
      fr: [
        'Place les avant-bras sur l’encadrement d’une porte, coudes juste sous la hauteur des épaules.',
        'Avance un pied et laisse le buste passer doucement dans l’ouverture.',
        'Arrête-toi dès que tu sens une tension légère devant les épaules.',
        'Respire lentement en tenant la position.',
      ],
      en: [
        'Place your forearms on a door frame, elbows just below shoulder height.',
        'Step one foot forward and let your chest move gently through the opening.',
        'Stop as soon as you feel mild tension across the front of your shoulders.',
        'Breathe slowly while holding the position.',
      ],
    },
    keyCue: {
      fr: 'Ne pousse pas plus loin : la tension doit rester légère, jamais douloureuse.',
      en: 'Do not push further: the stretch should stay mild, never painful.',
    },
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front-delts'],
    equipment: [[{ kind: 'door' }]],
    unilateral: false,
    position: 'standing',
    easier: ['wall-pec-stretch'],
    joints: { shoulder: 'moderate' },
  }),
  // Lats
  hold({
    id: 'wall-lat-stretch',
    name: { fr: 'Étirement des dorsaux au mur', en: 'Wall lat stretch' },
    execution: {
      fr: [
        'Face à un mur, pose les deux mains dessus à hauteur de hanches ou un peu plus haut.',
        'Recule les pieds et penche le buste vers l’avant, dos plat.',
        'Appuie doucement la poitrine vers le sol jusqu’à sentir un étirement sur les côtés du dos.',
        'Respire calmement ; sans rebond, tension légère, jamais de douleur.',
      ],
      en: [
        'Face a wall and place both hands on it at hip height or slightly higher.',
        'Step your feet back and lean your torso forward with a flat back.',
        'Gently sink your chest toward the floor until you feel a stretch along the sides of your back.',
        'Breathe slowly; no bouncing, mild tension, never pain.',
      ],
    },
    keyCue: {
      fr: 'Garde le dos plat et les côtes rentrées, sans à-coups.',
      en: 'Keep your back flat and ribs tucked, with no bouncing.',
    },
    primaryMuscles: ['lats'],
    secondaryMuscles: ['rear-delts', 'triceps'],
    equipment: [[{ kind: 'wall' }]],
    unilateral: false,
    position: 'standing',
    harder: ['door-frame-lat-stretch'],
    joints: {},
  }),
  hold({
    id: 'door-frame-lat-stretch',
    name: { fr: 'Étirement des dorsaux à l’encadrement de porte', en: 'Door-frame lat stretch' },
    difficulty: 2,
    execution: {
      fr: [
        'Saisis le bord d’un encadrement de porte solide d’une main, à hauteur de poitrine.',
        'Recule les hanches et laisse le buste s’incliner en tournant légèrement.',
        'Sens l’étirement sur le côté du dos, bras tendu.',
        'Respire calmement ; sans rebond, tension légère, jamais de douleur. Change de côté.',
      ],
      en: [
        'Hold the edge of a sturdy door frame with one hand at chest height.',
        'Sit your hips back and let your torso lean away with a slight turn.',
        'Feel the stretch along the side of your back, arm straight.',
        'Breathe slowly; no bouncing, mild tension, never pain. Switch sides.',
      ],
    },
    keyCue: {
      fr: 'Appuie-toi doucement, sans te suspendre à l’encadrement.',
      en: 'Lean gently and do not hang your full weight from the frame.',
    },
    primaryMuscles: ['lats'],
    secondaryMuscles: ['rear-delts', 'obliques'],
    equipment: [[{ kind: 'door' }]],
    unilateral: true,
    position: 'standing',
    easier: ['wall-lat-stretch'],
    joints: {},
  }),
  // Posterior shoulder
  hold({
    id: 'cross-body-shoulder-stretch',
    name: { fr: 'Étirement de l’épaule bras croisé', en: 'Cross-body shoulder stretch' },
    execution: {
      fr: [
        'Debout ou assis, amène un bras tendu en travers de la poitrine.',
        'Avec l’autre main, maintiens-le contre toi, juste au-dessus du coude.',
        'Garde l’épaule étirée basse, loin de l’oreille.',
        'Respire calmement ; sans rebond, tension légère, jamais de douleur. Change de côté.',
      ],
      en: [
        'Standing or seated, bring one straight arm across your chest.',
        'Use your other hand to hold it against you, just above the elbow.',
        'Keep the stretched shoulder down, away from your ear.',
        'Breathe slowly; no bouncing, mild tension, never pain. Switch sides.',
      ],
    },
    keyCue: {
      fr: 'Maintiens le bras sans le tirer fort : tension légère seulement.',
      en: 'Hold the arm in place without pulling hard: mild tension only.',
    },
    primaryMuscles: ['rear-delts'],
    secondaryMuscles: ['upper-back', 'side-delts'],
    equipment: [[]],
    unilateral: true,
    position: 'standing',
    harder: ['thread-the-needle'],
    joints: {},
  }),
  hold({
    id: 'standing-upper-back-reach',
    name: { fr: 'Étirement du haut du dos mains jointes', en: 'Standing upper back reach' },
    execution: {
      fr: [
        'Debout, grand, joins les mains devant toi à hauteur de poitrine.',
        'Pousse les mains loin devant et arrondis le haut du dos.',
        'Rentre doucement le menton, sans baisser la tête.',
        'Respire calmement ; sans rebond, tension légère, jamais de douleur.',
      ],
      en: [
        'Stand tall and clasp your hands in front of you at chest height.',
        'Push your hands far forward and round your upper back.',
        'Gently tuck your chin without dropping your head.',
        'Breathe slowly; no bouncing, mild tension, never pain.',
      ],
    },
    keyCue: {
      fr: 'Éloigne les mains en arrondissant le haut du dos : tension légère entre les omoplates.',
      en: 'Reach away and round the upper back: mild tension between the shoulder blades.',
    },
    primaryMuscles: ['upper-back'],
    secondaryMuscles: ['rear-delts', 'traps'],
    equipment: [[]],
    unilateral: false,
    position: 'standing',
    joints: {},
  }),
  hold({
    id: 'thread-the-needle',
    name: { fr: 'Passage du fil de l’aiguille', en: 'Thread the needle' },
    difficulty: 2,
    execution: {
      fr: [
        'À quatre pattes sur un tapis, mains sous les épaules, genoux sous les hanches.',
        'Glisse un bras tendu sous la poitrine, paume vers le haut, jusqu’à poser l’épaule et la joue au sol.',
        'Garde les hanches au-dessus des genoux, puis reviens doucement.',
        'Respire calmement ; sans rebond, tension légère, jamais de douleur. Change de côté.',
      ],
      en: [
        'Start on all fours on a mat, hands under shoulders, knees under hips.',
        'Slide one straight arm under your chest, palm up, until your shoulder and cheek rest on the floor.',
        'Keep your hips above your knees, then come back gently.',
        'Breathe slowly; no bouncing, mild tension, never pain. Switch sides.',
      ],
    },
    keyCue: {
      fr: 'Descends seulement jusqu’à une tension légère dans l’épaule et le haut du dos.',
      en: 'Go only as far as a mild stretch in the shoulder and upper back.',
    },
    primaryMuscles: ['rear-delts', 'upper-back'],
    secondaryMuscles: ['traps'],
    equipment: [[{ kind: 'mat' }]],
    unilateral: true,
    position: 'floor',
    easier: ['cross-body-shoulder-stretch'],
    joints: { shoulder: 'moderate', wrist: 'moderate' },
  }),
  // Neck and upper traps
  hold({
    id: 'seated-neck-side-tilt',
    name: { fr: 'Inclinaison latérale du cou assis', en: 'Seated neck side tilt' },
    execution: {
      fr: [
        'Assis sur une chaise ou debout, dos droit, épaules relâchées.',
        'Incline doucement l’oreille vers l’épaule du même côté, sans la lever.',
        'Laisse seulement le poids de la tête agir, sans la tirer avec la main.',
        'Arrête si tu sens des fourmillements ou une douleur qui descend dans le bras.',
        'Respire calmement ; sans rebond, tension légère, jamais de douleur. Change de côté.',
      ],
      en: [
        'Sit on a chair or stand with a tall back and relaxed shoulders.',
        'Gently tilt your ear toward the same shoulder without lifting the shoulder.',
        'Let only the weight of your head do the work; do not pull it with your hand.',
        'Stop if you feel tingling or pain running down the arm.',
        'Breathe slowly; no bouncing, mild tension, never pain. Switch sides.',
      ],
    },
    keyCue: {
      fr: 'Garde l’épaule basse et reste en tension très légère.',
      en: 'Keep the shoulder down and stay at very mild tension.',
    },
    primaryMuscles: ['traps'],
    secondaryMuscles: [],
    equipment: [[{ kind: 'chair', count: 1 }], []],
    unilateral: true,
    position: 'standing',
    joints: {},
  }),
  // Triceps
  hold({
    id: 'overhead-triceps-stretch',
    name: { fr: 'Étirement des triceps au-dessus de la tête', en: 'Overhead triceps stretch' },
    execution: {
      fr: [
        'Debout, lève un bras et plie le coude pour amener la main derrière la tête.',
        'Avec l’autre main, appuie doucement sur le coude vers l’arrière.',
        'Garde les côtes rentrées et le cou long.',
        'Respire calmement ; sans rebond, tension légère, jamais de douleur. Change de côté.',
      ],
      en: [
        'Stand and raise one arm, bending the elbow to bring your hand behind your head.',
        'Use your other hand to gently press the elbow back.',
        'Keep your ribs tucked and your neck long.',
        'Breathe slowly; no bouncing, mild tension, never pain. Switch sides.',
      ],
    },
    keyCue: {
      fr: 'Pousse doucement, sans cambrer le bas du dos.',
      en: 'Press gently without arching your lower back.',
    },
    primaryMuscles: ['triceps'],
    secondaryMuscles: ['lats'],
    equipment: [[]],
    unilateral: true,
    position: 'standing',
    harder: ['chair-elbows-lat-triceps-stretch'],
    joints: {},
  }),
  // Biceps and forearms
  hold({
    id: 'chair-elbows-lat-triceps-stretch',
    name: {
      fr: 'Étirement triceps et dorsaux coudes sur chaise',
      en: 'Chair elbows lat and triceps stretch',
    },
    difficulty: 2,
    execution: {
      fr: [
        'À genoux sur un tapis face à une chaise, pose les coudes sur l’assise, mains derrière la tête.',
        'Recule les hanches vers les talons, sans t’asseoir dessus si ça pince les genoux.',
        'Laisse la poitrine descendre vers le sol jusqu’à une tension légère sous les bras.',
        'Respire calmement ; sans rebond, tension légère, jamais de douleur.',
      ],
      en: [
        'Kneel on a mat facing a chair, elbows on the seat and hands behind your head.',
        'Sit your hips back toward your heels, without sitting on them if your knees pinch.',
        'Let your chest sink toward the floor until you feel mild tension under your arms.',
        'Breathe slowly; no bouncing, mild tension, never pain.',
      ],
    },
    keyCue: {
      fr: 'Garde les côtes rentrées et recule les hanches sans cambrer le bas du dos.',
      en: 'Keep your ribs tucked and sit back without arching your lower back.',
    },
    primaryMuscles: ['triceps', 'lats'],
    secondaryMuscles: ['rear-delts'],
    equipment: [[{ kind: 'chair', count: 1 }, { kind: 'mat' }]],
    unilateral: false,
    position: 'floor',
    easier: ['overhead-triceps-stretch'],
    joints: { shoulder: 'moderate', knee: 'moderate' },
  }),
  hold({
    id: 'wall-biceps-stretch',
    name: { fr: 'Étirement des biceps au mur', en: 'Wall biceps stretch' },
    execution: {
      fr: [
        'Debout de côté contre un mur, pose la paume à plat derrière toi, doigts vers l’arrière.',
        'Garde le bras tendu, légèrement sous la hauteur de l’épaule.',
        'Tourne doucement le buste à l’opposé jusqu’à sentir une tension devant le bras.',
        'Respire calmement ; sans rebond, tension légère, jamais de douleur. Change de côté.',
      ],
      en: [
        'Stand sideways to a wall and place your palm flat on it behind you, fingers pointing back.',
        'Keep the arm straight, slightly below shoulder height.',
        'Slowly turn your chest away until you feel mild tension along the front of the arm.',
        'Breathe slowly; no bouncing, mild tension, never pain. Switch sides.',
      ],
    },
    keyCue: {
      fr: 'Tourne lentement, sans à-coups, jusqu’à une tension légère.',
      en: 'Turn slowly with no bouncing, to a mild stretch.',
    },
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['chest', 'front-delts'],
    equipment: [[{ kind: 'wall' }]],
    unilateral: true,
    position: 'standing',
    joints: {},
  }),
  hold({
    id: 'standing-wrist-flexor-stretch',
    name: { fr: 'Étirement des fléchisseurs du poignet', en: 'Wrist flexor stretch' },
    execution: {
      fr: [
        'Tends un bras devant toi, paume vers le haut.',
        'Avec l’autre main, ramène doucement les doigts vers le sol.',
        'Garde le coude tendu et l’épaule détendue.',
        'Respire lentement, puis change de côté.',
      ],
      en: [
        'Extend one arm in front of you, palm up.',
        'With your other hand, gently draw your fingers toward the floor.',
        'Keep the elbow straight and the shoulder relaxed.',
        'Breathe slowly, then switch sides.',
      ],
    },
    keyCue: {
      fr: 'Tire doucement : tension légère dans l’avant-bras, jamais de douleur.',
      en: 'Pull gently: mild tension in the forearm, never pain.',
    },
    primaryMuscles: ['forearms'],
    secondaryMuscles: [],
    equipment: [[]],
    unilateral: true,
    position: 'standing',
    harder: ['kneeling-wrist-flexor-stretch'],
    joints: {},
  }),
  hold({
    id: 'kneeling-wrist-flexor-stretch',
    name: { fr: 'Étirement des avant-bras à quatre pattes', en: 'Kneeling wrist flexor stretch' },
    difficulty: 2,
    execution: {
      fr: [
        'À quatre pattes sur un tapis, pose les paumes au sol, doigts vers les genoux.',
        'Garde les paumes à plat et recule doucement les hanches vers les talons.',
        'Arrête-toi dès que tu sens une tension légère dans les avant-bras.',
        'Respire calmement ; sans rebond, tension légère, jamais de douleur.',
      ],
      en: [
        'Start on all fours on a mat, palms on the floor with fingers pointing toward your knees.',
        'Keep your palms flat and gently sit your hips back toward your heels.',
        'Stop as soon as you feel mild tension in your forearms.',
        'Breathe slowly; no bouncing, mild tension, never pain.',
      ],
    },
    keyCue: {
      fr: 'Reste léger sur les mains : ne laisse pas tout le poids du corps peser dessus.',
      en: 'Stay light on your hands: do not let your full body weight sit on them.',
    },
    primaryMuscles: ['forearms'],
    secondaryMuscles: [],
    equipment: [[{ kind: 'mat' }]],
    unilateral: false,
    position: 'floor',
    easier: ['standing-wrist-flexor-stretch'],
    joints: { wrist: 'moderate' },
  }),
  hold({
    id: 'standing-wrist-extensor-stretch',
    name: { fr: 'Étirement des extenseurs du poignet', en: 'Wrist extensor stretch' },
    execution: {
      fr: [
        'Tends un bras devant toi, paume vers le sol, poignet fléchi, doigts vers le bas.',
        'Avec l’autre main, ramène doucement le dos de la main vers toi.',
        'Garde le coude tendu et l’épaule détendue.',
        'Respire lentement, puis change de côté.',
      ],
      en: [
        'Extend one arm in front of you, palm down, wrist bent so your fingers point down.',
        'With your other hand, gently draw the back of your hand toward you.',
        'Keep the elbow straight and the shoulder relaxed.',
        'Breathe slowly, then switch sides.',
      ],
    },
    keyCue: {
      fr: 'Tire doucement : tension légère sur le dessus de l’avant-bras, jamais de douleur.',
      en: 'Pull gently: mild tension on top of the forearm, never pain.',
    },
    primaryMuscles: ['forearms'],
    secondaryMuscles: [],
    equipment: [[]],
    unilateral: true,
    position: 'standing',
    joints: {},
  }),
  // Trunk
  hold({
    id: 'knees-to-chest-stretch',
    name: { fr: 'Genoux à la poitrine', en: 'Knees to chest' },
    execution: {
      fr: [
        'Allongé sur le dos sur un tapis, ramène les genoux vers la poitrine.',
        'Entoure les jambes de tes mains, sans forcer.',
        'Laisse le bas du dos s’aplatir au sol et la tête se relâcher.',
        'Respire calmement ; sans rebond, tension légère, jamais de douleur.',
      ],
      en: [
        'Lie on your back on a mat and draw your knees toward your chest.',
        'Wrap your hands around your legs without forcing.',
        'Let your lower back settle toward the floor and your head relax.',
        'Breathe slowly; no bouncing, mild tension, never pain.',
      ],
    },
    keyCue: {
      fr: 'Garde la nuque relâchée et ramène les genoux sans tirer fort.',
      en: 'Keep your neck relaxed and draw your knees in without pulling hard.',
    },
    primaryMuscles: ['lower-back'],
    secondaryMuscles: ['glutes'],
    equipment: [[{ kind: 'mat' }]],
    unilateral: false,
    position: 'floor',
    joints: {},
  }),
  hold({
    id: 'childs-pose',
    name: { fr: 'Posture de l’enfant', en: 'Child’s pose' },
    execution: {
      fr: [
        'À genoux sur un tapis, orteils joints et genoux écartés.',
        'Assieds-toi vers les talons et allonge les bras devant toi.',
        'Pose le front au sol ou sur tes mains et relâche le dos.',
        'Mets un coussin sous les genoux ou entre les fesses et les talons si besoin.',
        'Respire calmement ; sans rebond, tension légère, jamais de douleur.',
      ],
      en: [
        'Kneel on a mat with your big toes together and knees apart.',
        'Sit back toward your heels and reach your arms forward.',
        'Rest your forehead on the floor or on your hands and let your back relax.',
        'Put a cushion under your knees, or between your hips and heels, if needed.',
        'Breathe slowly; no bouncing, mild tension, never pain.',
      ],
    },
    keyCue: {
      fr: 'Laisse le poids du corps descendre, sans forcer : tension légère uniquement.',
      en: 'Let your body weight settle without forcing: mild tension only.',
    },
    primaryMuscles: ['lower-back', 'lats'],
    secondaryMuscles: ['glutes'],
    equipment: [[{ kind: 'mat' }]],
    unilateral: false,
    position: 'floor',
    joints: { knee: 'moderate' },
  }),
  hold({
    id: 'open-book-stretch',
    name: { fr: 'Livre ouvert', en: 'Open book' },
    execution: {
      fr: [
        'Allongé sur le côté sur un tapis, genoux fléchis, bras tendus devant toi, mains jointes.',
        'Lève le bras du dessus et ouvre-le vers l’arrière en suivant la main du regard.',
        'Garde les genoux l’un sur l’autre et laisse le haut du dos pivoter ; laisse le bras se poser où il arrive, sans forcer.',
        'Respire calmement ; sans rebond, tension légère, jamais de douleur. Change de côté.',
      ],
      en: [
        'Lie on your side on a mat with knees bent and arms straight in front, palms together.',
        'Lift the top arm and open it backward, following your hand with your eyes.',
        'Keep your knees stacked and let your upper back rotate; let the arm rest where it lands, don’t force it down.',
        'Breathe slowly; no bouncing, mild tension, never pain. Switch sides.',
      ],
    },
    keyCue: {
      fr: 'Garde les genoux joints : la rotation vient du haut du dos.',
      en: 'Keep your knees together: the turn comes from your upper back.',
    },
    primaryMuscles: ['upper-back', 'chest'],
    secondaryMuscles: ['obliques'],
    equipment: [[{ kind: 'mat' }]],
    unilateral: true,
    position: 'floor',
    joints: {},
  }),
  hold({
    id: 'seated-chair-twist',
    name: { fr: 'Rotation du buste sur chaise', en: 'Seated chair twist' },
    execution: {
      fr: [
        'Assis de côté sur une chaise, dos droit, pieds au sol.',
        'Tourne doucement le buste vers le dossier et saisis-le avec les mains.',
        'Grandis-toi à l’inspiration et tourne un peu plus à l’expiration.',
        'Reviens au centre. Respire calmement ; sans rebond, tension légère, jamais de douleur. Change de côté.',
      ],
      en: [
        'Sit sideways on a chair with a tall back and feet on the floor.',
        'Slowly turn your torso toward the backrest and hold it with your hands.',
        'Grow taller as you breathe in and turn slightly more as you breathe out.',
        'Return to centre. Breathe slowly; no bouncing, mild tension, never pain. Switch sides.',
      ],
    },
    keyCue: {
      fr: 'Tourne en t’allongeant, sans tirer fort sur le dossier.',
      en: 'Turn while staying tall, without pulling hard on the backrest.',
    },
    primaryMuscles: ['obliques'],
    secondaryMuscles: ['lower-back'],
    equipment: [[{ kind: 'chair' }]],
    unilateral: true,
    position: 'chair',
    harder: ['supine-spinal-twist'],
    joints: {},
  }),
  hold({
    id: 'supine-spinal-twist',
    name: { fr: 'Torsion allongée', en: 'Supine spinal twist' },
    execution: {
      fr: [
        'Allongé sur le dos sur un tapis, ramène les genoux vers la poitrine, bras en croix.',
        'Laisse les genoux tomber doucement d’un côté.',
        'Garde les épaules vers le sol et tourne la tête si c’est confortable.',
        'Respire calmement ; sans rebond, tension légère, jamais de douleur. Change de côté.',
      ],
      en: [
        'Lie on your back on a mat, knees drawn toward your chest, arms out to the sides.',
        'Let both knees drop gently to one side.',
        'Keep your shoulders toward the floor and turn your head if comfortable.',
        'Breathe slowly; no bouncing, mild tension, never pain. Switch sides.',
      ],
    },
    keyCue: {
      fr: 'Laisse les genoux descendre par leur propre poids, sans les pousser.',
      en: 'Let your knees drop under their own weight; do not push them.',
    },
    primaryMuscles: ['obliques', 'lower-back'],
    secondaryMuscles: ['glutes', 'chest'],
    equipment: [[{ kind: 'mat' }]],
    unilateral: true,
    position: 'floor',
    difficulty: 2,
    easier: ['seated-chair-twist'],
    joints: {},
  }),
  hold({
    id: 'standing-side-bend',
    name: { fr: 'Flexion latérale debout', en: 'Standing side bend' },
    execution: {
      fr: [
        'Debout, pieds écartés à la largeur du bassin, un bras levé au-dessus de la tête.',
        'Incline-toi doucement du côté opposé, sans pivoter.',
        'Garde les deux hanches face à l’avant.',
        'Reviens lentement.',
        'Respire calmement ; sans rebond, tension légère, jamais de douleur. Change de côté.',
      ],
      en: [
        'Stand with feet hip-width apart and one arm raised overhead.',
        'Gently lean to the opposite side without twisting.',
        'Keep both hips facing forward.',
        'Return slowly.',
        'Breathe slowly; no bouncing, mild tension, never pain. Switch sides.',
      ],
    },
    keyCue: {
      fr: 'Incline-toi sans à-coups, jusqu’à une tension légère sur le flanc.',
      en: 'Lean with no bouncing, to a mild stretch along your side.',
    },
    primaryMuscles: ['obliques', 'lats'],
    secondaryMuscles: [],
    equipment: [[]],
    unilateral: true,
    position: 'standing',
    joints: {},
  }),
  // Breathing and relaxation
  hold({
    id: 'chair-legs-breathing',
    name: { fr: 'Respiration jambes sur chaise', en: 'Legs-on-chair breathing' },
    execution: {
      fr: [
        'Allongé sur le dos sur un tapis, pose les mollets sur une chaise, ou garde les pieds à plat genoux fléchis.',
        'Pose les mains sur les côtes basses.',
        'Inspire lentement par le nez en sentant les côtes s’écarter.',
        'Expire longuement et laisse le bas du dos se détendre.',
      ],
      en: [
        'Lie on your back on a mat with your calves on a chair, or feet flat with knees bent.',
        'Place your hands on your lower ribs.',
        'Breathe in slowly through your nose, feeling your ribs widen.',
        'Breathe out long and let your lower back relax.',
      ],
    },
    keyCue: {
      fr: 'Allonge l’expiration : plus elle est lente, plus tu te détends.',
      en: 'Lengthen the exhale: the slower it is, the more you relax.',
    },
    primaryMuscles: ['abs', 'lower-back'],
    secondaryMuscles: ['obliques'],
    equipment: [[{ kind: 'chair' }, { kind: 'mat' }], [{ kind: 'mat' }]],
    unilateral: false,
    position: 'floor',
    joints: {},
  }),
  hold({
    id: 'legs-up-the-wall',
    name: { fr: 'Jambes au mur', en: 'Legs up the wall' },
    execution: {
      fr: [
        'Assieds-toi de côté contre un mur, puis allonge-toi sur le dos en levant les jambes contre le mur.',
        'Rapproche les fesses du mur autant que c’est confortable, bras relâchés sur les côtés.',
        'Ferme les yeux et respire lentement par le nez.',
        'Pour sortir, plie les genoux et roule sur le côté avant de te relever.',
      ],
      en: [
        'Sit sideways next to a wall, then lie back and swing your legs up against it.',
        'Shuffle your hips as close to the wall as is comfortable, arms relaxed at your sides.',
        'Close your eyes and breathe slowly through your nose.',
        'To come out, bend your knees and roll onto your side before sitting up.',
      ],
    },
    keyCue: {
      fr: 'Fléchis un peu les genoux si l’arrière des cuisses tire trop.',
      en: 'Bend your knees slightly if the backs of your thighs feel too tight.',
    },
    primaryMuscles: ['lower-back'],
    secondaryMuscles: ['hamstrings', 'calves'],
    equipment: [[{ kind: 'wall' }, { kind: 'mat' }]],
    unilateral: false,
    position: 'floor',
    joints: {},
  }),
  hold({
    id: 'seated-slow-breathing',
    name: { fr: 'Respiration lente assise', en: 'Seated slow breathing' },
    execution: {
      fr: [
        'Assis sur une chaise (ou en tailleur sur un tapis), dos droit, mains sur les cuisses.',
        'Inspire par le nez pendant environ 4 secondes.',
        'Expire doucement pendant environ 6 secondes.',
        'Relâche les épaules et la mâchoire à chaque souffle.',
      ],
      en: [
        'Sit on a chair (or cross-legged on a mat) with a tall back and hands on your thighs.',
        'Breathe in through your nose for about 4 seconds.',
        'Breathe out gently for about 6 seconds.',
        'Relax your shoulders and jaw with each breath.',
      ],
    },
    keyCue: {
      fr: 'Garde un souffle calme et fluide, sans retenir ni forcer.',
      en: 'Keep the breath calm and smooth, without holding or forcing it.',
    },
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques'],
    equipment: [[{ kind: 'chair' }], [{ kind: 'mat' }]],
    unilateral: false,
    position: 'chair',
    joints: {},
  }),
];
