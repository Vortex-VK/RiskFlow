from app.schemas.responses import ValidationIssue
from app.schemas.scenario import AccountNode, ContextAssociation, ScenarioDefinition, ScenarioNode


def validate_scenario(
    scenario: ScenarioDefinition, *, require_complete: bool = True
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []

    def add(path: str, code: str, message: str, entity_id: str | None = None) -> None:
        issues.append(ValidationIssue(path=path, code=code, message=message, entityId=entity_id))

    seen_ids: set[str] = set()
    for collection_name, collection in (
        ("nodes", scenario.nodes),
        ("associations", scenario.associations),
        ("payments", scenario.payments),
    ):
        for index, item in enumerate(collection):
            if item.id in seen_ids:
                add(
                    f"{collection_name}[{index}].id",
                    "duplicate_id",
                    "IDs must be unique across nodes, relationships, and payments.",
                    item.id,
                )
            seen_ids.add(item.id)
    nodes = {node.id: node for node in scenario.nodes}

    def referenced_node(
        node_id: str, expected: str, path: str, owner_id: str
    ) -> ScenarioNode | None:
        node = nodes.get(node_id)
        if node is None:
            add(path, "missing_node", f"The referenced {expected} does not exist.", owner_id)
        elif node.type != expected:
            add(path, "wrong_node_type", f"Select a node of type {expected}.", owner_id)
            return None
        return node

    associations: dict[tuple[str, str, str], ContextAssociation] = {}
    for index, association in enumerate(scenario.associations):
        path = f"associations[{index}]"
        account = referenced_node(
            association.account_id, "account", f"{path}.accountId", association.id
        )
        target_type = "device" if association.type == "accountDevice" else "location"
        referenced_node(association.target_id, target_type, f"{path}.targetId", association.id)
        key = (association.type, association.account_id, association.target_id)
        if key in associations:
            add(path, "duplicate_association", "This relationship already exists.", association.id)
        else:
            associations[key] = association
        if isinstance(account, AccountNode) and association.observed_at < account.opened_at:
            add(
                f"{path}.observedAt",
                "before_account_opening",
                "A relationship cannot be observed before the account opened.",
                association.id,
            )
        if association.known_from is not None and association.known_from < association.observed_at:
            add(
                f"{path}.knownFrom",
                "before_observation",
                "Familiarity cannot begin before the relationship was observed.",
                association.id,
            )

    for index, payment in enumerate(scenario.payments):
        path = f"payments[{index}]"
        account = referenced_node(payment.account_id, "account", f"{path}.accountId", payment.id)
        referenced_node(payment.merchant_id, "merchant", f"{path}.merchantId", payment.id)
        if payment.occurred_at < scenario.scenario_start_at:
            add(
                f"{path}.occurredAt",
                "before_scenario_start",
                "A payment cannot precede the scenario start.",
                payment.id,
            )
        if isinstance(account, AccountNode) and payment.occurred_at < account.opened_at:
            add(
                f"{path}.occurredAt",
                "before_account_opening",
                "A payment cannot precede the account opening.",
                payment.id,
            )
        for node_id, node_type, field, association_type in (
            (payment.device_id, "device", "deviceId", "accountDevice"),
            (payment.location_id, "location", "locationId", "accountLocation"),
        ):
            target = referenced_node(node_id, node_type, f"{path}.{field}", payment.id)
            if account is None or target is None:
                continue
            context = associations.get((association_type, payment.account_id, node_id))
            if context is None:
                add(
                    f"{path}.{field}",
                    "missing_association",
                    f"Connect this account to the selected {node_type} first.",
                    payment.id,
                )
            elif context.observed_at > payment.occurred_at:
                add(
                    f"{path}.{field}",
                    "context_not_observed",
                    f"The selected {node_type} was not observed at the payment time.",
                    payment.id,
                )

    payment_ids = {payment.id for payment in scenario.payments}
    for event_id in scenario.ground_truth:
        if event_id not in payment_ids:
            add(
                f"groundTruth.{event_id}",
                "missing_payment",
                "A synthetic label must refer to an existing payment.",
                event_id,
            )
    if scenario.policy.review_threshold >= scenario.policy.block_threshold:
        add(
            "policy.reviewThreshold",
            "threshold_order",
            "The review threshold must be lower than the block threshold.",
        )
    if require_complete:
        node_types = {node.type for node in scenario.nodes}
        for node_type in ("account", "merchant", "device", "location"):
            if node_type not in node_types:
                add("nodes", "required_node_type", f"Add at least one {node_type} to simulate.")
        if not scenario.payments:
            add("payments", "required_payment", "Add at least one payment to simulate.")
    return issues
