function buildStrategicAnalysis(
  reasoning
) {

  const summary = [];

  const recommendations = [];

  const projectRisks = [];

  const opportunities = [];

  if(
    reasoning.semanticAnalysis
      ?.vendorKnowledge
  ) {

    summary.push(
      "Vendor relevan ditemukan berdasarkan historical memory"
    );

    recommendations.push(
      "Gunakan vendor dengan pengalaman proyek serupa"
    );
  }

  if(
    reasoning.semanticAnalysis
      ?.constructionKnowledge
  ) {

    opportunities.push(
      "Tersedia pengalaman pekerjaan struktur beton"
    );

    opportunities.push(
      "Tersedia pengalaman pekerjaan baja"
    );
  }

  if(
    !reasoning.semanticAnalysis
      ?.internetKnowledge
  ) {

    projectRisks.push(
      "Belum ada intelligence internet untuk proyek ini"
    );
  }

  return {

    summary,

    recommendations,

    projectRisks,

    opportunities
  };
}

module.exports = {
  buildStrategicAnalysis
};
