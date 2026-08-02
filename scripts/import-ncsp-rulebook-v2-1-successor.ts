import { importNcspRulebookV21Successor } from "@/lib/clinical-rules/importer";

function getArgument(name: string) {
  const prefix = `--${name}=`;
  return process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}

async function main() {
  const result = await importNcspRulebookV21Successor({
    sourceDirectory: getArgument("source"),
    actorUserId: getArgument("actor-user-id"),
    reason: getArgument("reason"),
  });
  console.log(
    JSON.stringify(
      {
        ...result,
        validation: {
          valid: result.validation.valid,
          counts: result.validation.counts,
        },
        publicationStatus: "UNPUBLISHED",
        activationStatus: "INACTIVE",
        authority: "LEGACY",
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
