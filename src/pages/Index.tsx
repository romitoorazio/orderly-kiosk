import React from "react";
import CustomerTotem from "./CustomerTotem";

const Index: React.FC = () => {
  // Compat con la query ?mode=...; in tutti i casi rendiamo il totem cliente.
  return <CustomerTotem />;
};

export default Index;
