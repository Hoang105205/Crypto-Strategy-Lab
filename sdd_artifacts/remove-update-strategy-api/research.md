# Research: Remove Update Strategy API

## Decisions

### D1: How to handle UI interactions for existing strategies?
- **Chosen**: The UI should only allow "Create New" or "Save as New". If a user selects an existing strategy and tweaks parameters, saving it will generate a new POST request (creating a new strategy ID).
- **Rationale**: This aligns with the immutability concept. We don't need a complex branching logic; just treat all saves as POST (creation).
- **Alternatives considered**: Hiding the save button entirely if an existing strategy is selected. (Rejected because users want to clone/tweak existing strategies easily).

### D2: Do we need a soft-delete or deprecation for the API?
- **Chosen**: Hard remove the endpoint.
- **Rationale**: We are in MVP and no external clients depend on the `PUT` endpoint. We can safely remove it from the controller to ensure no internal code can call it by mistake.
