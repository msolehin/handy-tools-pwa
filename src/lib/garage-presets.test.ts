import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultPresets, presetsFor, kindsFor, gradesFor, engineSpec, typeKey,
  COST_CATEGORY_KEY, DEFAULT_COST_CATEGORIES, costCategories, BODIES, ENERGIES,
} from './garage-presets.ts';

describe('service presets', () => {
  test('an EV is never asked about engine oil', () => {
    const list = defaultPresets('sedan', 'ev');
    assert.ok(!list.includes('Engine oil'));
    assert.ok(!list.includes('Spark plug'));
    assert.ok(list.includes('12V battery'));
  });

  test('a diesel swaps the spark plug for fuel filtration', () => {
    const list = defaultPresets('pickup', 'diesel');
    assert.ok(!list.includes('Spark plug'));
    assert.ok(list.includes('Fuel filter'));
    assert.ok(list.includes('DPF service'));
  });

  test('a motorcycle gets a chain and not a cabin filter', () => {
    const list = defaultPresets('motorcycle', 'petrol');
    assert.ok(list.includes('Chain & sprocket'));
    assert.ok(!list.includes('Cabin filter'));
  });

  test('a lorry adds body-specific items on top of its energy base', () => {
    const list = defaultPresets('lorry', 'diesel');
    assert.ok(list.includes('Engine oil'));          // from the diesel base
    assert.ok(list.includes('Puspakom inspection')); // from the body extras
  });

  test('a hybrid keeps the petrol base and adds hybrid items', () => {
    const list = defaultPresets('sedan', 'hybrid');
    assert.ok(list.includes('Engine oil'));
    assert.ok(list.includes('Hybrid battery inspection'));
  });

  test('customs are appended and never duplicate a default', () => {
    const list = presetsFor('sedan', 'petrol', ['Timing belt', 'Engine oil'], []);
    assert.equal(list.filter((i) => i === 'Engine oil').length, 1);
    assert.equal(list.at(-1), 'Timing belt');
  });

  test('hidden items are removed', () => {
    const list = presetsFor('sedan', 'petrol', [], ['Engine oil']);
    assert.ok(!list.includes('Engine oil'));
  });

  test('typeKey pairs body and energy', () => {
    assert.equal(typeKey('sedan', 'petrol'), 'sedan:petrol');
  });

  test('a diesel motorcycle is not offered a spark plug either', () => {
    const list = defaultPresets('motorcycle', 'diesel');
    assert.ok(!list.includes('Spark plug'));
    assert.ok(list.includes('Fuel filter'));
    assert.ok(list.includes('Chain & sprocket'));   // still a bike
  });

  test('a hybrid motorcycle keeps its chain and gains its battery check', () => {
    const list = defaultPresets('motorcycle', 'hybrid');
    assert.ok(list.includes('Chain & sprocket'));
    assert.ok(list.includes('Hybrid battery inspection'));
  });
});

describe('energy characteristics', () => {
  test('only a PHEV holds both kinds', () => {
    assert.deepEqual(kindsFor('petrol'), ['fuel']);
    assert.deepEqual(kindsFor('hybrid'), ['fuel']);   // self-charging: never plugs in
    assert.deepEqual(kindsFor('ev'), ['charge']);
    assert.deepEqual(kindsFor('phev'), ['fuel', 'charge']);
  });

  test('grades follow the energy and the kind', () => {
    assert.ok(gradesFor('petrol', 'fuel').includes('RON95'));
    assert.ok(gradesFor('diesel', 'fuel').includes('Diesel B7'));
    assert.ok(gradesFor('phev', 'charge').includes('DC fast'));
  });
});

describe('engine spec', () => {
  test('an EV reports its battery, not a displacement', () => {
    assert.equal(engineSpec('suv', 'ev').unit, 'kWh');
    assert.equal(engineSpec('suv', 'ev').label, 'Battery');
  });

  test('a bike is quoted in cc and a car in litres', () => {
    assert.equal(engineSpec('motorcycle', 'petrol').unit, 'cc');
    assert.equal(engineSpec('sedan', 'petrol').unit, 'L');
  });

  test('an electric motorcycle still reports a battery', () => {
    assert.equal(engineSpec('motorcycle', 'ev').unit, 'kWh');
  });
});

describe('cost categories', () => {
  test('one default ships, and it is the toll/parking one', () => {
    assert.deepEqual(costCategories(), ['Tol & parkir']);
  });

  test('customs are appended and never duplicate the default', () => {
    const list = costCategories(['Saman', 'Tol & parkir', 'Cuci kereta'], []);
    assert.equal(list.filter((c) => c === 'Tol & parkir').length, 1);
    assert.deepEqual(list, ['Tol & parkir', 'Saman', 'Cuci kereta']);
  });

  test('a hidden default is removed', () => {
    assert.deepEqual(costCategories(['Saman'], ['Tol & parkir']), ['Saman']);
  });

  test('hiding everything is allowed — an empty list, not a silent fallback to the default', () => {
    assert.deepEqual(costCategories([], ['Tol & parkir']), []);
  });

  // The reserved key shares a table with the service checklists, whose keys are body:energy
  // pairs. The leading underscore is the whole guarantee that the two can never collide, so it
  // is asserted rather than assumed.
  test('the reserved key can never collide with a real vehicle type key', () => {
    for (const body of Object.keys(BODIES) as (keyof typeof BODIES)[]) {
      for (const energy of Object.keys(ENERGIES) as (keyof typeof ENERGIES)[]) {
        assert.notEqual(typeKey(body, energy), COST_CATEGORY_KEY);
      }
    }
    assert.ok(COST_CATEGORY_KEY.startsWith('_'));
  });

  test('the default list is not mutable through a returned array', () => {
    costCategories().push('Oops');
    assert.deepEqual(DEFAULT_COST_CATEGORIES, ['Tol & parkir']);
  });
});
