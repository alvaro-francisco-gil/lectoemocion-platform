# Spain and EU privacy baseline

This document is a product-engineering baseline, not legal advice. Each pilot
requires review by qualified counsel and the controller's Data Protection
Officer.

## Data in scope

- Teacher identity and account data.
- School and class membership.
- Children's first names.
- Recognisable photos.
- Voice recordings of names.
- Initial letter/sound and template participation.
- Resources that combine those fields.
- Security and access audit events.

## Roles

For institutional school use, the school or relevant education authority will
typically be the controller. LectoEmoción will typically be a processor.
Teachers act under the controller's authority. Hosting, authentication, email,
monitoring, and support providers may be subprocessors.

Contracts and product copy must not claim that uploading content makes the
teacher solely responsible. The controller determines purpose, lawful basis,
authorised users, retention, and required transparency.

## Initial safeguards

- Creator-only authorisation.
- Private EU-region storage.
- TLS in transit and provider-supported encryption at rest.
- Short-lived upload and download URLs.
- Tenant-safe database queries and storage paths.
- No public resources or security-by-obscure-link.
- No facial recognition, biometrics, transcription, voice cloning, or AI
  processing.
- No model training, advertising, or behavioural profiling.
- Minimal operational logs with personal-data redaction.
- Configurable retention and verifiable deletion.
- Subprocessor inventory and change process.
- Incident-response and data-subject-rights procedures.
- Synthetic data only before pilot approval.

## Required pre-pilot artefacts

- GDPR Article 28 data-processing agreement.
- Record of processing details supplied to controllers.
- Data-flow and subprocessor register.
- International-transfer assessment where applicable.
- Technical and organisational measures.
- Retention schedule.
- Security incident plan.
- Data-subject request and deletion procedure.
- DPIA screening and, when required, a completed DPIA.
- Spanish-language teacher and parent transparency notices.
- School approval process for the application.

## Engineering rules

- Production child media must never enter source control or developer fixtures.
- Support staff receive no default access to media.
- Privileged access is time-bound, justified, and audited.
- Deleting a child record revokes media access and invalidates dependent
  resources before asynchronous physical deletion completes.
- Backups have documented expiry and restoration-aware deletion procedures.
- Analytics use template identifiers and technical performance events, not
  names, raw media, or permanent child identifiers.

## References

- AEPD, *Protección de datos en centros educativos*:  
  <https://www.aepd.es/guias/guia-centros-educativos.pdf>
- AEPD guidance on school applications and cloud services:  
  <https://www.aepd.es/prensa-y-comunicacion/notas-de-prensa/la-aepd-publica-un-informe-sobre-la-utilizacion-de>
- GDPR, including Article 28 processor obligations:  
  <https://eur-lex.europa.eu/eli/reg/2016/679/oj>

