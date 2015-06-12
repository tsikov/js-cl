// global variables
var stats;
var data;
var timer;

// helper fns
function countBits(n) {
  var count = 0;
  for (; n !== 0; count++) { n &= n - 1; };
  return count;
}
function random(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min };
function product(array) { return array.reduce(function (prev, curr) { return prev * curr }) };
function sum(array) { return array.reduce(function(prev, curr) { return prev + curr }) };
function avrg(array) { return sum(array)/array.length };
function min(array) { return Math.min.apply(Math, array) }
function max(array) { return Math.max.apply(Math, array) }
function maxIdx(array) { return array.indexOf(max(array)) };
function minIdx(array) { return array.indexOf(min(array)) };
function best(population, fitnesses) { return fitnesses[maxIdx(fitnesses)]; }
function worst(population, fitnesses) { return fitnesses[minIdx(fitnesses)]; }
function normalize(array) {
  var sumArr = sum(array);
  return array.map(function(m) { return m/sumArr });
}
function memoize(fn){
  var cache = {};
  return function(arg){
    if(arg in cache) {
      return cache[arg];
    } else {
      return cache[arg] = fn(arg);
    }
  }
}
function sumProduct(chromosome) {
  var GOAL_SUM = 143;
  var GOAL_PRODUCT = 1000;
  var DATASET = [5, 4, 3, 3, 7, 5, 9, 6, 7, 9, 10, 4, 9, 1, 5, 3, 2, 4, 1, 2, 1, 4, 1, 7, 5, 9, 10, 5, 7, 3, 3, 7, 3, 3, 5];
  var sum = 0;
  var product = 1;
  var score;

  chromosome = chromosome.toString(2);

  // these are all correct answers:
  // 01111111110110110111011111011111111
  // 01111111110111111100011111011111111
  // 11111111110111110101110111011111110
  for (var i = 0, l = chromosome.length; i < l; i ++) {
    var bit = chromosome[i];
    if (bit === "1") {
      sum += DATASET[i];
    } else {
      product *= DATASET[i];
    }
  }

  score = Math.sqrt(Math.pow(sum - GOAL_SUM, 2) + Math.pow(product - GOAL_PRODUCT, 2));
  return 1/(score + 1);
}
function hammingDistance(c1, c2) {
  return countBits(c1 ^ c2);
}
function hdp(population) {
  var hdSum = 0;
  var l = population.length;
  var ahd;
  for (var i = 0; i < l; i ++) {
    var first = population[i];
    for (var j = i+1; j < l; j ++) {
      var second = population[j];
      hdSum += hammingDistance(first, second);
    }
  }
  ahd = (hdSum*2)/(l*(l-1));
  return 1/(ahd+1);
}
function bestN(population, fitnesses, n) {
  var tmpFitnesses = fitnesses.slice();
  var tmpPopulation = population.slice();
  var best = [];
  for (var i = 0; i < n; i ++) {
    var tmpIdx = maxIdx(tmpFitnesses);
    best.push(tmpPopulation[tmpIdx]);
    tmpPopulation.splice(tmpIdx, 1);
    tmpFitnesses.splice(tmpIdx, 1);
  }
  return best;
}
function display() {
  var displayData = [stats.avg, stats.fittest];
  if (data.hdp) { displayData.push(stats.hdp); }
  $.plot($("#stream"), displayData, {});
}
function generatePopulation(sizeOfPopulation) {
  return new Array(sizeOfPopulation+1).join().split("").map(function() {
    return parseInt(randomBits(data.chromosomeLength), 2);
  });
}
function randomBits(n) {
  var someBits = Math.random().toString(2).slice(2,-1);
  var l = someBits.length;
  if (n <= l) {
    return someBits.slice(0,n);
  } else {
    return someBits + randomBits(n-l);
  }
}
// mutation fns
function mutate(c, mr, time) {
  var lo = c & 0x3fffffff,
      hi = (c - lo) / 0x40000000,
      l = data.chromosomeLength - time*30 < 30 ? data.chromosomeLength - time*30 : 30;

  for (var i = 0; i < l; i ++) {
    lo = Math.random() < mr ? lo ^ Math.pow(2, i) : lo;
  }
  if (hi > 0) {
    return mutate(hi, mr, ++time) * 0x40000000 + lo;
  } else {
    return lo;
  }
};
function FMR(mr) {
  return function(chromosome) {
    return mutate(chromosome, mr, 0);
  }
}
function DMR(gc, cl, iter) {
  var mr = 1/(2+(gc*(cl-2)/iter));
  $("#mutation-rate").val(mr);
  return function(chromosome) {
    return mutate(chromosome, mr, 0);
  }
}
function IAMR(k1, k2, fmax, favg) { // = indiavidually adaptive mr / adaprive ga
  return function(chromosome) {
    var f = data.fitnessFn(chromosome),
        mr = f > favg ? k1*(fmax - f)/(fmax - favg) : k2;
    return mutate(chromosome, mr, 0);
  }
}
function CPLO() {
  return function(chromosome) {
    return mutate(chromosome, 0.001, 0);
  }
}
function CPLO_PARENT() {
  return function(chromosome) {
    return mutate(chromosome, 0.1, 0);
  }
}
function noChangeFn() {
  return function(chromosome) {
    return chromosome;
  }
}
// selection fns
function getIdx(fss, point) {
  var sum = 0;
  for (var i = 0, l = fss.length; i < l; i ++) {
    sum += fss[i];
    if (sum > point) {
      return i;
    }
  }
};
function RWS(population, fitnesses, chosenCount) {
  var normalizedFitnesses = normalize(fitnesses);

  return new Array(chosenCount+1).join().split("").map(function() {
    return population[getIdx(normalizedFitnesses, Math.random())];
  });
}
function SUS(population, fitnesses, chosenCount) {
  var totalFitness = sum(fitnesses),
      dist = totalFitness/chosenCount,
      start = Math.random() * dist;

  return new Array(chosenCount+1).join().split("").map(function(cv, idx) {
    return population[getIdx(fitnesses, start+(idx*dist))]
  });
}
function TRUNC(population, fitnesses, chosenCount) {
  var p = 1/2;
  var matingPool = bestN(population, fitnesses, chosenCount/2);
  return matingPool.concat(matingPool);
}
function RANDS(population, fitnesses, chosenCount) {
  return new Array(chosenCount+1).join().split("").map(function() {
    return population[random(0, data.populationCount-1)];
  });
}
function TOUR(population, fitnesses, chosenCount) {
  var winners = [];
  for (var i = 0; i < chosenCount; i ++) {
    var cPopulation = [];
    var cFitnesses = [];
    var winner;
    for (var j = 0; j < data.tournamentSize; j ++) {
      var rand = random(0, data.populationCount-1);
      cPopulation.push(population[rand]);
      cFitnesses.push(fitnesses[rand]);
    }
    winner = cPopulation[maxIdx(cFitnesses)];
    winners.push(winner);
  }
  return winners;
}
// crossover fns
function crossoverOPC(c1, c2) {
  var splitting = Math.pow(2, random(1, data.chromosomeLength-1)),
      c1_s = c1 & (splitting-1),
      c2_s = c2 & (splitting-1);
      c1_f = (c1 - c1_s) / splitting;
      c2_f = (c2 - c2_s) / splitting;
  return [ c1_f * splitting + c2_s, c2_f * splitting + c1_s];
}
function crossoverROG1(c1, c2) {
  var randIdx;
  if (c1 === c2) {
    randIdx = random(1, data.chromosomeLength-1);
    return [c1.slice(0, randIdx) + c2.slice(randIdx), randomBits(data.chromosomeLength)];
  } else {
    return crossoverOPC(c1, c2);
  }
}
function crossoverROG2(c1, c2) {
  var randIdx;
  if (c1 === c2) {
    randIdx = random(1, data.chromosomeLength-1);
    return [randomBits(data.chromosomeLength), randomBits(data.chromosomeLength)];
  } else {
    return crossoverOPC(c1, c2);
  }
}
// strategy fns
function nextGen(population) {
  var fitnesses = population.map(data.fitnessFn),
    newPopulation = bestN(population, fitnesses, data.elitistCount),
    chosen,
    avg = avrg(fitnesses),
    fittest = best(population, fitnesses),
    childMutateFn,
    parentMutateFn;

  $('#result').text(population[maxIdx(fitnesses)].toString(2));

  // push stats
  stats.avg.push([data.generationCount, avg]);
  stats.fittest.push([data.generationCount, fittest]);
  if (data.hdp) { stats.hdp.push([data.generationCount, hdp(population)]); }

  chosen = data.selectionFn(population, fitnesses, data.populationCount - data.elitistCount);

  parentMutateFn = data.mutationFn === CPLO ? CPLO_PARENT() :
                                              noChangeFn();

  childMutateFn = data.mutationFn === IAMR ? IAMR(data.iamrK1, data.iamrK2, fittest, avg) :
                  data.mutationFn === DMR  ? DMR(data.generationCount, data.chromosomeLength, data.iterations) :
                  data.mutationFn === CPLO ? CPLO() :
                                             FMR(data.mutationRate);

  for (var i = 0, l = chosen.length; i < l; i += 2) {
    var c1 = chosen[i],
        c2 = chosen[i+1],
        newChromosomes;

    if (Math.random() < data.crossoverRate) {
      c1 = parentMutateFn(c1);
      c2 = parentMutateFn(c2);
      newChromosomes = data.crossoverFn(c1, c2);
      newPopulation = newPopulation.concat([childMutateFn(c1), childMutateFn(c2)]);
    } else {
      newPopulation = newPopulation.concat([c1, c2]);
    }
  }
  return newPopulation;
}
// main fns
function run() {
  var population = generatePopulation(data.populationCount);
  var start;
  if (data.live) {
    timer = setInterval(function() {
      population = nextGen(population);
      display();
      data.generationCount++;
    }, 1);
  } else {
    start = new Date();
    for (; data.generationCount < data.iterations; data.generationCount ++) {
      population = nextGen(population);
    }
    console.log(new Date() - start);
    display();
  }
}
function updateData() {
  var strategyFn = $("input[name=strategy]:checked").val();
  var crossoverFn = $("input[name=crossover]:checked").val();
  var selectionFn = $("input[name=selection]:checked").val();
  var fitnessFn = $("input[name=fitness]:checked").val();
  var memoization = $("#memoization").is(":checked");
  var mutationFn = $("input[name=mutation]:checked").val();

  data = {
    mutationRate: parseFloat($("#mutation-rate").val()),
    crossoverRate: parseFloat($("#crossover-rate").val()),
    elitistCount: parseInt($("#elitist-count").val()),
    iterations: parseInt($("#iterations").val()),
    chromosomeLength: parseInt($("#chromosome-length").val()),
    populationCount: parseInt($("#population-count").val()),
    rog: $("input[name=rog]:checked").val(),
    hdp: $("#HDP").is(":checked"),
    live: $("#live").is(":checked"),
    generationCount: 0,
    iamrK1: parseFloat($("#iamr-k1").val()),
    iamrK2: parseFloat($("#iamr-k2").val()),
    tournamentSize: parseFloat($("#tour-s").val())
  };

  data.selectionFn = selectionFn === "sus"   ? SUS :
                     selectionFn === "trunc" ? TRUNC :
                     selectionFn === "tour"  ? TOUR :
                     selectionFn === "rand"  ? RANDS :
                                               RWS;

  data.crossoverFn = crossoverFn === "rog-1" ? crossoverROG1 :
                     crossoverFn === "rog-2" ? crossoverROG2 :
                                               crossoverOPC;

  data.mutationFn = mutationFn === "dmr"  ? DMR :
                    mutationFn === "iamr" ? IAMR :
                    mutationFn === "cplo" ? CPLO :
                                            FMR;

  // TODO: more graceful handling of customFn
  data.fitnessFn = fitnessFn === "sum-product" ? sumProduct : customFn;
  if (memoization) {
    data.fitnessFn = memoize(data.fitnessFn);
  }

}
function clearStats() {
  stats = {
    avg: [],
    fittest: [],
    unfittest: [],
    hdp: []
  };
}
function start() {
  stop();
  clearStats();
  updateData();
  run();
}
function stop() { clearInterval(timer); }

