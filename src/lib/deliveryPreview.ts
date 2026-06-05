import type { DeliveryOrderPreview } from "../components/DeliveryWorkflowScreen";

export const previewDeliveryOrder: DeliveryOrderPreview = {
  id: "order-preview-1001",
  customerName: "Maya Thompson",
  customerAddress: "101 E Kennedy Blvd, Tampa, FL 33602",
  items: [
    {
      id: "item-1",
      name: "BayBlaze Citrus Gummies",
      variant: "Blood Orange / 10 pack",
      quantity: 2,
      imageUrl: "https://placehold.co/160x160/f6f8f5/2c541d?text=Citrus",
      inventoryLocation: "vehicle",
    },
    {
      id: "item-2",
      name: "BayBlaze Mint Disposable",
      variant: "1g / Cool Mint",
      quantity: 1,
      imageUrl: "https://placehold.co/160x160/f6f8f5/2c541d?text=Mint",
      inventoryLocation: "warehouse",
    },
  ],
};
