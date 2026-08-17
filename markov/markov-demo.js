const MarkovGenerator = require('./markov-generator.js');

// Sample corpus
const corpus = `
The quick brown fox jumps over the lazy dog. The lazy dog sleeps all day long.
The brown fox is quick and clever. Quick foxes are hard to catch.
Dogs love to chase foxes but this lazy dog prefers to sleep.
All day the fox runs and jumps while the dog dreams of chasing.
`;

const generator = new MarkovGenerator();
generator.train(corpus);

console.log('=== WORD MODE ===\n');

for (let order = 1; order <= 4; order++) {
  console.log(`Order ${order}:`);
  console.log(generator.generate({ length: 20, mode: 'word', order }));
  console.log();
}

console.log('=== CHAR MODE ===\n');

for (let order = 2; order <= 8; order += 2) {
  console.log(`Order ${order}:`);
  console.log(generator.generate({ length: 100, mode: 'char', order }));
  console.log();
}

// Test with JSON corpus format
console.log('=== JSON CORPUS FORMAT ===\n');

const jsonCorpus = [
  { text: "Hello world, this is a test." },
  { text: "Testing the Markov chain generator." },
  { text: "Generators generate generated generations." }
];

generator.train(jsonCorpus);
console.log('From array of objects:');
console.log(generator.generate({ length: 15, mode: 'word', order: 1 }));
