# CPR Phase Workflow

1. Maximus creates a phase report and attachments; status becomes `waiting_client`.
2. Client chooses one action:
   - **Revisi**: submit text and optional files. Request count increments (maximum 2); phase becomes `revision_requested`.
   - **Approved**: insert an approval event. Only a project member with role `client` can do this.
3. Maximus publishes the next immutable report version after addressing the feedback.
4. After revision 1, client can request revision 2 or approve.
5. After revision 2, the client can only approve. The revision control is no longer available.
6. Approval is immutable; the database marks the phase approved and unlocks the next ordered phase.

## Role ownership
- Maximus: create/edit project setup, phases, reports, report versions, Maximus-authored attachments, and replies.
- Client: read released phase content, submit revision requests, upload client attachments, comment, and approve.
- Neither UI nor API allows Maximus to approve on behalf of the client.

## Phase visibility
All phase labels/order can be visible in navigation. A phase's content is readable only when unlocked for that project. A locked phase must not leak report/file data through APIs.