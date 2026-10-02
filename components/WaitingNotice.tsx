export default function WaitingNotice({kind}:{kind:'review'|'example'|'preparing'}){
  return <div className="waiting-notice" role="status">
    <strong>{kind==='example'?'Writing your example meeting':kind==='review'?'Reviewing your meeting':'Preparing your review'}</strong>
    <p>Please wait and keep this page open. Do not refresh, close the tab or leave this page until it finishes.</p>
    <p className="helper">{kind==='example'?'Your current transcript stays in place until the example is ready.':kind==='review'?'We are checking the transcript against all seven scoring sections.':''} Longer requests can take several minutes. You can cancel if you need to stop.</p>
  </div>;
}
