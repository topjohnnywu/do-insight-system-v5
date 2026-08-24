/* Sample / seed data (classic script → window.SampleData). Types stripped. */
(function () {
  const INITIAL_HEADER = {
    doNo: '',
    destination: '',
    shipBy: '',
    packBy: '',
    approvedBy: '',
    date: new Date().toISOString().split('T')[0],
    customer: '',
  };

  const INITIAL_ITEMS = [];

  const createBlankItems = (count = 1) => {
    return Array.from({ length: count }, (_, index) => ({
      id: `blank-${Date.now()}-${index}`,
      skidNo: index === 0 ? 'SKID-01' : `SKID-${(index + 1).toString().padStart(2, '0')}`,
      code8D: '',
      qty: '',
      totalCarton: '',
      weightKg: '',
      lengthCm: '',
      widthCm: '',
      heightCm: '',
    }));
  };

  const SAMPLE_LOOKUP_DATABASE = [];

  window.SampleData = {
    INITIAL_HEADER,
    INITIAL_ITEMS,
    createBlankItems,
    SAMPLE_LOOKUP_DATABASE,
  };
})();
