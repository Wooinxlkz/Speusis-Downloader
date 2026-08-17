export default function UpdateWarnDialog() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] leading-5">
        Because of frequent changes to sites and servers, Speusis needs to keep up with those
        changes, and that's why Speusis is updated frequently. It's important to always use the
        latest version to keep everything working correctly.
        <br /><br />
        Are you sure you don't want to update?
      </p>
      <div className="flex justify-end">
        <button className="rounded bg-accent text-bg px-3 py-1.5 font-semibold" onClick={() => window.close()}>Back</button>
      </div>
    </div>
  );
}
