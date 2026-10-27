export function ModelValidation() {
  return (
    <details className="model-validation">
      <summary>Overall model evaluation</summary>
      <p>
        Results across separate evaluation datasets, independent of the selected
        sample or any CSV you upload.
      </p>
      <h3>IBM evaluation · installed model</h3>
      <div className="validation-numbers">
        <div>
          <strong>97.72%</strong>
          <span>fraud recall</span>
        </div>
        <div>
          <strong>92.78%</strong>
          <span>alert precision</span>
        </div>
        <div>
          <strong>20</strong>
          <span>false alerts</span>
        </div>
      </div>
      <p>
        257 of 263 labeled frauds detected across 334,777 transactions, using
        the frozen card and online cutoffs.
      </p>
      <p>
        On a separate customer holdout from the authored source: 23 of 30 frauds
        detected, with 2 false alerts across 1,935 transactions.
      </p>
      <p className="fineprint">
        These evaluations use IBM and authored synthetic data. They are separate
        from the current upload’s results. Performance varies by source:
        transfer to Sparkov was poor, and probability calibration on new sources
        needs validation. The installed model improves authored detection but
        trades away some IBM precision and older-online recall compared with its
        predecessor.
      </p>
    </details>
  );
}
