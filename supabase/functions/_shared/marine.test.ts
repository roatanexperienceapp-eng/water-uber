import { deepStrictEqual as eq, ok } from 'node:assert';
import { parseMarineAnswer, safetyFor } from './marine.ts';

Deno.test('parses a good answer and adds our own safety notes', () => {
  const r = parseMarineAnswer('Here: {"found": true, "commonName": "Red lionfish", "scientificName": "Pterois volitans", "group": "fish", "confidence": "high", "facts": ["Invasive in the Caribbean.", "Eaten in Roatán restaurants."]}');
  eq(r.found, true);
  eq(r.commonName, 'Red lionfish');
  eq(r.safety, ['venomous_spines']);
  eq(r.facts.length, 2);
});

Deno.test('turtles are protected; coral must not be touched', () => {
  eq(safetyFor('Hawksbill turtle', 'Eretmochelys imbricata'), ['protected_do_not_touch', 'do_not_feed']);
  ok(safetyFor('Elkhorn coral', 'Acropora palmata').includes('do_not_touch_coral'));
  eq(safetyFor('Blue tang', 'Acanthurus coeruleus'), []);
});

Deno.test('malformed or empty answers never become a made-up species', () => {
  eq(parseMarineAnswer('I think it is a fish').found, false);
  eq(parseMarineAnswer('{"found": true}').found, false);
  eq(parseMarineAnswer('{"found": false}').found, false);
  eq(parseMarineAnswer('{"found": true, "commonName": "X", "group": "dragon", "confidence": "sure"}').group, 'other');
  eq(parseMarineAnswer('{"found": true, "commonName": "X", "confidence": "sure"}').confidence, 'low');
});
