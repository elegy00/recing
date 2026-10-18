import { createFileRoute } from "@tanstack/react-router";
import IngestPage from "../../pages/IngestPage";

export const Route = createFileRoute("/import/queue")({ component: IngestPage });
