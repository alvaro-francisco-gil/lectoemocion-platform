# Spain and EU privacy baseline

This document is a product-engineering baseline, not legal advice. Each pilot
requires review by qualified counsel and the controller's Data Protection
Officer.

## Data in scope

- Adult identity and account data.
- Group membership, whether a school class or a family.
- Children's first names.
- Recognisable photos.
- Voice recordings of names.
- Initial letter/sound and template participation.
- Progress and unlock state.
- Resources that combine those fields.
- Security and access audit events.

Product-authored default content is not personal data. Only uploaded
personalisation and the records describing it fall in scope.

## Roles

The product is sold to institutions and directly to families. The controller
differs, and the difference is material.

### Institutional use

The school or relevant education authority will typically be the controller.
LectoEmoción will typically be a processor. Teachers act under the controller's
authority. Hosting, authentication, email, monitoring, and support providers
may be subprocessors.

Contracts and product copy must not claim that uploading content makes the
teacher solely responsible. The controller determines purpose, lawful basis,
authorised users, retention, and required transparency.

A teacher uploads photographs of other people's children. This is the heavier
obligation and requires the full pre-pilot artefact set below.

### Direct family use

The parent or holder of parental responsibility is the controller for their own
child's data. There is no Article 28 processor chain, and no school approval
process.

This is a lighter obligation, not an empty one:

- children's personal data remains subject to the GDPR and the Spanish
  LOPDGDD;
- the account holder must be an adult, and the service is contracted with the
  adult, not the child;
- consent and transparency must be obtained directly, in Spanish, in plain
  language, before any upload;
- deletion, data-subject rights, security, retention, and EU hosting
  obligations are unchanged.

Product copy must not imply that a family account carries no obligations, and
must not blur the two models. A single account is one market or the other; the
applicable notices and terms follow from that.

### Common to both

Owner-only access, private storage, EU-region hosting, no exportable media, no
public sharing, no profiling, no model training, and verifiable deletion apply
regardless of market.

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

### Family market

- Spanish-language parent transparency notice and terms.
- Consent capture before first upload.
- Data-subject request and deletion procedure.
- Retention schedule.
- Technical and organisational measures.
- Security incident plan.
- Subprocessor inventory and change process.
- International-transfer assessment where applicable.

### Staged institutional pilot

A pilot using product-authored default content only — no uploads, no child
media, no child personal data — requires none of the artefacts below beyond
ordinary adult-account handling. This is the intended first pilot.

Personalisation is enabled for a deployment only when that deployment's
artefacts are complete. Enabling uploads first is prohibited.

### Institutional market

For personalisation, everything in the family list above, plus:

- GDPR Article 28 data-processing agreement.
- Record of processing details supplied to controllers.
- Data-flow and subprocessor register.
- DPIA screening and, when required, a completed DPIA.
- Spanish-language teacher transparency notice.
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

