function evaluateStrategies(
  strategies
) {

  const evaluated = [];

  for(
    const strategy
    of strategies
  ) {

    let score = 0;

    if(
      strategy.cost <
      50000000
    ) {

      score += 3;
    }

    if(
      strategy.risk <
      5
    ) {

      score += 5;
    }

    if(
      strategy.timeline <
      120
    ) {

      score += 2;
    }

    if(
      strategy.vendorStability >
      7
    ) {

      score += 4;
    }

    evaluated.push({

      ...strategy,

      score
    });
  }

  evaluated.sort(

    (
      a,
      b
    ) =>

      b.score -
      a.score
  );

  return {

    bestStrategy:
      evaluated[0],

    alternatives:
      evaluated.slice(1),

    evaluated
  };
}

module.exports = {
  evaluateStrategies
};
