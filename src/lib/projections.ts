import type { OrderRecord, OrderView, TicketRecord } from "@/types";

/** Removes the credential-derived hash before an order crosses an API/RSC boundary. */
export function toOrderView(order: OrderRecord): OrderView {
  const { accessTokenHash, ...view } = order;
  void accessTokenHash;
  return view;
}

/** Builds an explicit ticket projection so verification tokens and unknown input cannot escape. */
export function toTicketView(ticket: TicketRecord): TicketRecord {
  return {
    id: ticket.id,
    customerId: ticket.customerId,
    name: ticket.name,
    email: ticket.email,
    subject: ticket.subject,
    message: ticket.message,
    status: ticket.status,
    priority: ticket.priority,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt
  };
}
