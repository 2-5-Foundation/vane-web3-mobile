import ReceiverPending from './page-component/receiver-pending'

export default function Receive() {
  return (
    <div className="relative pt-2 px-4 max-w-sm mx-auto">
      <div className="space-y-2 max-h-[calc(100vh-8rem)] overflow-y-auto pb-12">
        <ReceiverPending />
      </div>
      
      {/* Gradient Fade Effect */}
      <div className="fixed bottom-16 left-0 right-0 h-16 bg-gradient-to-t from-[#0D1313] via-[#0D1313]/60 to-transparent pointer-events-none md:bottom-0" />
    </div>
  )
}
