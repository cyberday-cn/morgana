import { PageTabs } from './PageTabs'
import { PageContent } from './PageContent'

export function UIModule() {
  return (
    <div className="ui-module">
      <PageTabs />
      <PageContent />
    </div>
  )
}
