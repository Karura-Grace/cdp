// Tiny NOW to PREFERRED graphic for the Culture Score cells: same dots and arrow as the methodology gap diagram.
export default function NowPrefMini() {
  return (
    <span className="mini-np" aria-hidden="true">
      <span className="mini-np-pt now"><b>NOW</b></span>
      <span className="mini-np-line"></span>
      <span className="mini-np-pt pref"><b>PREFERRED</b></span>
    </span>
  );
}
