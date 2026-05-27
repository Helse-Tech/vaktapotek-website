import { Compass, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button, EmptyState } from "../components";

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="py-16">
      <EmptyState
        icon={Compass}
        title="Side ikke funnet"
        subtitle="Lenken er feil eller siden er flyttet."
        action={
          <Button iconLeft={Home} onClick={() => navigate("/")}>
            Tilbake til oversikt
          </Button>
        }
      />
    </div>
  );
}
