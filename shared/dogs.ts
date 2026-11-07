// The six made-up dogs. Shared by the caption route (server) and the main screen (client),
// so keep this file free of Node or browser APIs.
// Photos: public/dogs/, credits in CREDITS.md.

export interface Dog {
  id: string // rescue ID, OSR-0412 style
  slug: string
  name: string
  age: number
  sex: 'female' | 'male'
  blurb: string // short card line
  photo: string // path under public/
  photoAlt: string
  breed: string
  size: string
  facts: string[] // what the caption can draw on
  starterCaption: string // hand-written, shown on load; under 300 characters, no emoji
}

export const RESCUE_NAME = 'Odd Socks Dog Rescue'

export const DOGS: Dog[] = [
  {
    id: 'OSR-0412',
    slug: 'mochi',
    name: 'Mochi',
    age: 3,
    sex: 'female',
    blurb: '3 yrs · lap dog',
    photo: '/dogs/mochi.jpg',
    photoAlt: 'Mochi, a fawn pug, resting her chin on the arm of a gray couch',
    breed: 'pug',
    size: 'small, about 16 lb',
    facts: [
      'shaped like a loaf of bread and convinced every lap was built for her',
      'house trained',
      'good with cats and calm dogs',
      'follows her person from room to room',
      'snores softly, which her foster calls "white noise"',
      'short walks only; she prefers the couch to the trail',
    ],
    starterCaption:
      "Mochi is 3, shaped like a loaf of bread, and sure every lap was built for her. She's house trained, good with cats, and will follow you from room to room. Her foster calls her soft snoring white noise. Could your couch use a Mochi? Message us to meet her.",
  },
  {
    id: 'OSR-0398',
    slug: 'biscuit',
    name: 'Biscuit',
    age: 7,
    sex: 'male',
    blurb: '7 yrs · calm',
    photo: '/dogs/biscuit.jpg',
    photoAlt: 'Biscuit, a golden retriever, lying in the grass with his tongue out',
    breed: 'golden retriever',
    size: 'large, about 70 lb',
    facts: [
      'calm, steady and happy to nap through a busy day',
      'walks nicely on a leash',
      'good with kids, dogs and visitors',
      'knows sit, down and paw',
      'carries a toy around like it is his job',
      'came in when his owner moved into care',
    ],
    starterCaption:
      "Biscuit is 7 and has mastered the slow afternoon. He walks nicely on a leash, knows sit, down and paw, and carries a toy around like it's his job. He's good with kids, dogs and visitors, and ready for his next person. Message us to meet him.",
  },
  {
    id: 'OSR-0421',
    slug: 'rocket',
    name: 'Rocket',
    age: 1,
    sex: 'male',
    blurb: '1 yr · big energy',
    photo: '/dogs/rocket.jpg',
    photoAlt: 'Rocket, a curly brown poodle mix, running across a lawn with his tongue out',
    breed: 'poodle mix',
    size: 'medium, about 30 lb',
    facts: [
      'big energy and a top speed nobody has measured',
      'loves fetch, zoomies and anyone who will run with him',
      'learning sit and wait, and picks things up fast',
      'needs an active home and a fenced yard',
      'low-shedding curly coat',
      'crashes hard after a good run',
    ],
    starterCaption:
      "Rocket is 1 and lives up to his name. Fetch, zoomies, anyone who will run with him: he's in. He picks up sit and wait fast, has a low-shedding curly coat, and naps hard after a good run. Best with an active home and a fenced yard. Message us to meet him.",
  },
  {
    id: 'OSR-0377',
    slug: 'pepper',
    name: 'Pepper',
    age: 5,
    sex: 'female',
    blurb: '5 yrs · shy at first',
    photo: '/dogs/pepper.jpg',
    photoAlt: 'Pepper, a black and white mixed breed dog, looking up at the camera',
    breed: 'mixed breed',
    size: 'medium, about 40 lb',
    facts: [
      'shy at first and needs a few quiet days to settle in',
      'once she trusts you, she leans her whole weight against your legs',
      'best in a calm home without small children',
      'gets along with a confident, easygoing dog',
      'house trained and quiet indoors',
      'her foster says she is worth every bit of the wait',
    ],
    starterCaption:
      "Pepper is 5 and shy at first. Give her a few quiet days and she'll lean her whole weight against your legs. She's house trained, quiet indoors, and best in a calm home without small kids. Her foster says she's worth every bit of the wait. Message us to meet her.",
  },
  {
    id: 'OSR-0430',
    slug: 'pip',
    name: 'Pip',
    age: 2,
    sex: 'male',
    blurb: '2 yrs · small',
    photo: '/dogs/pip.jpg',
    photoAlt: 'Pip, a small tan chihuahua, standing alert in tall grass',
    breed: 'chihuahua',
    size: 'small, about 6 lb',
    facts: [
      'six pounds of opinions',
      'brave on walks and fond of tall grass',
      'loves warm blankets and burrowing',
      'does well in an apartment',
      'better with adults and older kids',
      'will sit politely for a treat',
    ],
    starterCaption:
      "Pip is 2, weighs 6 pounds, and has an opinion for each one. He's brave on walks, loves burrowing into warm blankets, and sits politely for a treat. Great for apartment life with adults or older kids. Message us to meet him.",
  },
  {
    id: 'OSR-0352',
    slug: 'tank',
    name: 'Tank',
    age: 9,
    sex: 'male',
    blurb: '9 yrs · gentle giant',
    photo: '/dogs/tank.jpg',
    photoAlt: 'Tank, a brindle great dane, lounging on a big dog bed in a living room',
    breed: 'great dane',
    size: 'giant, about 140 lb',
    facts: [
      'a gentle giant who thinks he is a lap dog',
      'calm indoors and slow on walks',
      'good with other dogs and polite with guests',
      'needs a home with few stairs for his older joints',
      'claims the biggest bed in any room',
      'senior dog, adoption fee waived',
    ],
    starterCaption:
      "Tank is 9, about 140 pounds, and still thinks he's a lap dog. He's calm indoors, slow on walks, and polite with guests and other dogs. He needs a home with few stairs for his older joints. Senior dog, adoption fee waived. Message us to meet him.",
  },
]

export function findDog(slug: string): Dog | undefined {
  return DOGS.find((d) => d.slug === slug)
}
